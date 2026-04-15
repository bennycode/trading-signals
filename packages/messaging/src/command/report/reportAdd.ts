import {ms} from 'ms';
import {createReport, getAvailableReportNames, reportRequiresAccount, resolveReportConfig} from 'trading-strategies';
import {Account} from '../../database/models/Account.js';
import {Report} from '../../database/models/Report.js';
import type {ReportAttributes} from '../../database/models/Report.js';

export interface ReportAddResult {
  message: string;
  report?: ReportAttributes;
}

export interface ReportAddOptions {
  /** When set, the report is saved to the DB and scheduled instead of run once. */
  intervalMs?: number;
}

export const reportAdd = async (
  request: string,
  userId: string,
  options: ReportAddOptions = {}
): Promise<ReportAddResult> => {
  const {intervalMs} = options;

  // Parse "<reportName> [<accountId>]"
  const parts = request.trim().split(/\s+/);
  const reportName = parts[0] ?? '';
  const accountIdStr = parts[1];

  const available = getAvailableReportNames();

  if (!reportName) {
    return {
      message: `Invalid format. Usage: /reportAdd <reportName> [<accountId>]\nAvailable reports: ${available.join(', ') || 'none (check environment variables)'}`,
    };
  }

  // Resolve base config from environment
  const config = resolveReportConfig(reportName);
  if (!config) {
    return {message: `Report "${reportName}" is not available. Either the report does not exist or its required environment variables are not set.\nAvailable reports: ${available.join(', ') || 'none'}`};
  }

  // If report requires an account, resolve credentials from the account database
  if (reportRequiresAccount(reportName)) {
    if (!accountIdStr) {
      return {message: `Report "${reportName}" requires an exchange account.\nUsage: /reportAdd ${reportName} <accountId>`};
    }

    const accountId = parseInt(accountIdStr, 10);

    if (isNaN(accountId)) {
      return {message: `Invalid account ID "${accountIdStr}". Must be a number.`};
    }

    const account = Account.findByUserIdAndId(userId, accountId);
    if (!account) {
      return {message: `Account ${accountId} not found. Use /accountList to see your accounts.`};
    }

    config.apiKey = account.apiKey;
    config.apiSecret = account.apiSecret;
  }

  const configJson = JSON.stringify(config);

  try {
    const report = createReport(reportName, config);

    // One-shot: run immediately and return results
    if (!intervalMs) {
      const result = await report.run();
      return {message: result};
    }

    // Scheduled: save to DB
    const row = Report.create({
      userId,
      reportName,
      config: configJson,
      intervalMs,
    });

    return {
      message: `Report scheduled (ID: ${row.id})\nReport: ${reportName}\nInterval: Every ${ms(intervalMs, {long: true})}`,
      report: row,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error: ${error.message}`};
    }
    return {message: 'Error running report'};
  }
};
