import {ms} from 'ms';
import {getReportNames, createReport} from 'trading-strategies';
import {Report} from '../../database/models/Report.js';
import type {ReportAttributes} from '../../database/models/Report.js';
import {assertInterval} from '../../validation/assertInterval.js';

export interface ReportAddResult {
  message: string;
  report?: ReportAttributes;
}

// Format: "<reportName> [configJSON] [--every <interval>]"
// Without --every: runs the report immediately and returns the output
// With --every: saves to DB and schedules recurring execution
// Example: "/reportAdd @typedtrader/report-sp500-momentum {"apiKey":"abc123"}"
// Example: "/reportAdd @typedtrader/report-sp500-momentum {"apiKey":"abc123"} --every 1d"
export const reportAdd = async (request: string, userId: string): Promise<ReportAddResult> => {
  const everyFlagIndex = request.indexOf(' --every ');
  let mainPart: string;
  let intervalMs: number | null = null;

  if (everyFlagIndex !== -1) {
    mainPart = request.slice(0, everyFlagIndex).trim();
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
    mainPart = request.trim();
  }

  const spaceIndex = mainPart.indexOf(' ');
  let reportName: string;
  let configJson: string;

  if (spaceIndex === -1) {
    reportName = mainPart;
    configJson = '{}';
  } else {
    reportName = mainPart.slice(0, spaceIndex);
    configJson = mainPart.slice(spaceIndex + 1).trim() || '{}';
  }

  if (!reportName) {
    return {
      message: `Invalid format. Usage: /reportAdd <reportName> [configJSON] [--every <interval>]\nAvailable reports: ${getReportNames().join(', ')}`,
    };
  }

  let config: unknown;
  try {
    config = JSON.parse(configJson);
  } catch {
    return {message: 'Invalid config JSON. Provide valid JSON or omit for default config.'};
  }

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
