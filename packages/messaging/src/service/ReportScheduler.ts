import {createReport, resolveReportConfig} from 'trading-strategies';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';
import {Report, type ReportAttributes} from '../database/models/Report.js';
import {logger} from '../logger.js';

interface ScheduledReport {
  reportId: number;
  timer: ReturnType<typeof setInterval>;
}

export class ReportScheduler {
  #platforms: Map<string, MessagingPlatform>;
  #scheduled: Map<number, ScheduledReport> = new Map();

  constructor(platforms: Map<string, MessagingPlatform>) {
    this.#platforms = platforms;
  }

  async start(): Promise<void> {
    const rows = Report.findAllWithInterval();
    for (const row of rows) {
      try {
        this.scheduleReport(row);
      } catch (error) {
        logger.error({err: error, reportId: row.id, reportName: row.reportName}, 'Failed to schedule report');
      }
    }
  }

  stop(): void {
    for (const scheduled of this.#scheduled.values()) {
      clearInterval(scheduled.timer);
    }
    this.#scheduled.clear();
  }

  scheduleReport(row: ReportAttributes, options: {runImmediately?: boolean} = {}): void {
    if (!row.intervalMs) {
      return;
    }

    if (this.#scheduled.has(row.id)) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        await this.#runAndNotify(row);
      } catch (error) {
        logger.error({err: error, reportId: row.id, reportName: row.reportName}, 'Scheduled report failed');
      }
    }, row.intervalMs);

    this.#scheduled.set(row.id, {reportId: row.id, timer});
    logger.info({reportId: row.id, reportName: row.reportName, intervalMs: row.intervalMs}, 'Scheduled report');

    if (options.runImmediately) {
      this.#runAndNotify(row).catch(error => {
        logger.error({err: error, reportId: row.id, reportName: row.reportName}, 'Initial run of scheduled report failed');
      });
    }
  }

  unscheduleReport(reportId: number): void {
    const scheduled = this.#scheduled.get(reportId);
    if (scheduled) {
      clearInterval(scheduled.timer);
      this.#scheduled.delete(reportId);
      logger.info({reportId}, 'Unscheduled report');
    }
  }

  async #runAndNotify(row: ReportAttributes): Promise<void> {
    const config = resolveReportConfig(row.reportName) ?? JSON.parse(row.config);
    const report = createReport(row.reportName, config);
    const result = await report.run();

    const platformPrefix = row.userId.split(':')[0];
    const platform = this.#platforms.get(platformPrefix);

    if (!platform) {
      logger.warn({platformPrefix, reportId: row.id}, 'No platform found for report');
      return;
    }

    await platform.sendMessage(row.userId, result);
    logger.info({reportId: row.id, userId: row.userId}, 'Report result sent');
  }
}
