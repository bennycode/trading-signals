import {ms} from 'ms';
import {createReport, resolveReportConfig} from 'trading-strategies';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';
import {Report, type ReportAttributes} from '../database/models/Report.js';

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
        console.error(`Failed to schedule report ${row.id} (${row.reportName}):`, error);
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
        console.error(`Scheduled report ${row.id} (${row.reportName}) failed:`, error);
      }
    }, row.intervalMs);

    this.#scheduled.set(row.id, {reportId: row.id, timer});
    console.log(`Scheduled report "${row.id}" (${row.reportName}) every ${ms(row.intervalMs, {long: true})}`);

    if (options.runImmediately) {
      this.#runAndNotify(row).catch(error => {
        console.error(`Initial run of scheduled report ${row.id} (${row.reportName}) failed:`, error);
      });
    }
  }

  unscheduleReport(reportId: number): void {
    const scheduled = this.#scheduled.get(reportId);
    if (scheduled) {
      clearInterval(scheduled.timer);
      this.#scheduled.delete(reportId);
      console.log(`Unscheduled report "${reportId}".`);
    }
  }

  async #runAndNotify(row: ReportAttributes): Promise<void> {
    const config = resolveReportConfig(row.reportName) ?? JSON.parse(row.config);
    const report = createReport(row.reportName, config);
    const result = await report.run();

    const platformPrefix = row.userId.split(':')[0];
    const platform = this.#platforms.get(platformPrefix);

    if (!platform) {
      console.warn(`No platform found for prefix "${platformPrefix}" when sending report ${row.id}`);
      return;
    }

    await platform.sendMessage(row.userId, result);
    console.log(`Report ${row.id} result sent to ${row.userId}`);
  }
}
