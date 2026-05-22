import {ms} from 'ms';
import {AlpacaAPI} from '@typedtrader/exchange';
import {createReport, getAvailableReportNames, reportRequiresAccount, resolveReportConfig} from 'trading-strategies';
import {Account} from '../../database/models/Account.js';
import {Report} from '../../database/models/Report.js';
import type {Account as AccountRow} from '../../database/schema.js';
import type {ReportAttributes} from '../../database/models/Report.js';

export interface ReportAddResult {
  message: string;
  report?: ReportAttributes;
}

export interface ReportAddOptions {
  intervalMs?: number;
}

export const reportAdd = async (
  request: string,
  userId: string,
  options: ReportAddOptions = {}
): Promise<ReportAddResult> => {
  const {intervalMs} = options;

  const parts = request.trim().split(/\s+/);
  const reportName = parts[0] ?? '';
  const accountIdStr = parts[1];

  const available = getAvailableReportNames();

  if (!reportName) {
    return {
      message: `Invalid format. Usage: /reportAdd <reportName> [<accountId>]\nAvailable reports: ${available.join(', ') || 'none (check environment variables)'}`,
    };
  }

  const config = resolveReportConfig(reportName);
  if (!config) {
    return {
      message: `Report "${reportName}" is not available. Either the report does not exist or its required environment variables are not set.\nAvailable reports: ${available.join(', ') || 'none'}`,
    };
  }

  let account: AccountRow | undefined;
  if (reportRequiresAccount(reportName)) {
    if (!accountIdStr) {
      return {
        message: `Report "${reportName}" requires an exchange account.\nUsage: /reportAdd ${reportName} <accountId>`,
      };
    }

    const accountId = parseInt(accountIdStr, 10);

    if (isNaN(accountId)) {
      return {message: `Invalid account ID "${accountIdStr}". Must be a number.`};
    }

    account = Account.findByUserIdAndId(userId, accountId);
    if (!account) {
      return {message: `Account ${accountId} not found. Use /accountList to see your accounts.`};
    }
  }

  const configJson = JSON.stringify(config);

  try {
    const api = account
      ? new AlpacaAPI({apiKey: account.apiKey, apiSecret: account.apiSecret, usePaperTrading: account.isPaper})
      : undefined;
    const report = createReport(reportName, config, api);

    if (!intervalMs) {
      const result = await report.run();
      return {message: result};
    }

    if (!account) {
      return {message: `Report "${reportName}" cannot be scheduled without an account.`};
    }
    const row = Report.create({
      userId,
      accountId: account.id,
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
