import {ms} from 'ms';
import {createReport, getAvailableReportNames, resolveReportConfig} from 'trading-strategies';
import {Report} from '../../database/models/Report.js';
import type {ReportAttributes} from '../../database/models/Report.js';
import {assertInterval} from '../../validation/assertInterval.js';

export interface ReportAddResult {
  message: string;
  report?: ReportAttributes;
}

// Format: "<reportName> [--every <interval>]"
// Without --every: runs the report immediately and returns the output
// With --every: saves to DB and schedules recurring execution
// Example: "/reportAdd @typedtrader/report-sp500-momentum"
// Example: "/reportAdd @typedtrader/report-sp500-momentum --every 1d"
export const reportAdd = async (request: string, userId: string): Promise<ReportAddResult> => {
  const everyFlagIndex = request.indexOf(' --every ');
  let reportName: string;
  let intervalMs: number | null = null;

  if (everyFlagIndex !== -1) {
    reportName = request.slice(0, everyFlagIndex).trim();
    const intervalStr = request.slice(everyFlagIndex + ' --every '.length).trim();
    if (!intervalStr) {
      return {message: 'Missing interval after --every flag. Examples: 1m, 1h, 1d, 1w'};
    }
    try {
      intervalMs = assertInterval(intervalStr);
    } catch {
      return {message: 'Invalid interval. Examples: 1m, 1h, 1d, 1w'};
    }
  } else {
    reportName = request.trim();
  }

  const available = getAvailableReportNames();

  if (!reportName) {
    return {
      message: `Invalid format. Usage: /reportAdd <reportName> [--every <interval>]\nAvailable reports: ${available.join(', ') || 'none (check environment variables)'}`,
    };
  }

  const config = resolveReportConfig(reportName);
  if (!config) {
    return {message: `Report "${reportName}" is not available. Either the report does not exist or its required environment variables are not set.\nAvailable reports: ${available.join(', ') || 'none'}`};
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
