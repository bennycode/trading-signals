import {AlpacaAPI} from '@typedtrader/exchange';
import {createReport, reportRequiresAccount} from 'trading-strategies';
import {Account} from '../database/models/Account.js';
import {Report, type ReportAttributes} from '../database/models/Report.js';
import {logger} from '../logger.js';
import {PlatformDispatcher} from './PlatformDispatcher.js';

interface ScheduledReport {
  reportId: number;
  timer: ReturnType<typeof setTimeout>;
}

export class ReportScheduler {
  #dispatcher: PlatformDispatcher;
  #scheduled: Map<number, ScheduledReport> = new Map();

  constructor(dispatcher: PlatformDispatcher) {
    this.#dispatcher = dispatcher;
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
      clearTimeout(scheduled.timer);
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

    const intervalMs = row.intervalMs;
    const now = Date.now();
    const elapsed = row.lastRunAt ? now - row.lastRunAt : Infinity;
    const initialDelay = options.runImmediately || elapsed >= intervalMs ? 0 : intervalMs - elapsed;

    const tick = async (): Promise<void> => {
      Report.updateLastRunAt(row.id, Date.now());
      try {
        await this.#runAndNotify(row);
      } catch (error) {
        logger.error({err: error, reportId: row.id, reportName: row.reportName}, 'Scheduled report failed');
      }
      const current = this.#scheduled.get(row.id);
      if (current) {
        current.timer = setTimeout(tick, intervalMs);
      }
    };

    this.#scheduled.set(row.id, {reportId: row.id, timer: setTimeout(tick, initialDelay)});
    logger.info(
      {reportId: row.id, reportName: row.reportName, intervalMs, initialDelay, lastRunAt: row.lastRunAt},
      'Scheduled report',
    );
  }

  unscheduleReport(reportId: number): void {
    const scheduled = this.#scheduled.get(reportId);
    if (scheduled) {
      clearTimeout(scheduled.timer);
      this.#scheduled.delete(reportId);
      logger.info({reportId}, 'Unscheduled report');
    }
  }

  async #runAndNotify(row: ReportAttributes): Promise<void> {
    const config = JSON.parse(row.config);

    let api: AlpacaAPI | undefined;
    if (reportRequiresAccount(row.reportName)) {
      const account = Account.findByPk(row.accountId);
      if (!account) {
        logger.warn({reportId: row.id, accountId: row.accountId}, 'Account not found for report — skipping run');
        return;
      }
      api = new AlpacaAPI({apiKey: account.apiKey, apiSecret: account.apiSecret, usePaperTrading: account.isPaper});
    }

    const report = createReport(row.reportName, config, api);
    const result = await report.run();

    const sent = await this.#dispatcher.sendToUser(row.userId, result);
    if (sent) {
      logger.info({reportId: row.id, userId: row.userId}, 'Report result sent');
    }
  }
}
