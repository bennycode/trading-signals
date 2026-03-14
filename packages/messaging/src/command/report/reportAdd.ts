// packages/messaging/src/command/report/reportAdd.ts
import {getReportNames, createReport} from 'trading-strategies';
import {Report} from '../../database/models/Report.js';
import type {ReportAttributes} from '../../database/models/Report.js';

export interface ReportAddResult {
  message: string;
  report?: ReportAttributes;
}

// Format: "<reportName> [configJSON] [--cron <expression>]"
// Example: "/reportAdd @typedtrader/report-sp500-momentum {"apiKey":"abc123"}"
// Example: "/reportAdd @typedtrader/report-sp500-momentum {"apiKey":"abc123"} --cron 0 9 * * 1"
export const reportAdd = async (request: string, userId: string): Promise<ReportAddResult> => {
  const cronFlagIndex = request.indexOf(' --cron ');
  let mainPart: string;
  let cron: string | null = null;

  if (cronFlagIndex !== -1) {
    mainPart = request.slice(0, cronFlagIndex).trim();
    cron = request.slice(cronFlagIndex + ' --cron '.length).trim();
    if (!cron) {
      return {message: 'Missing cron expression after --cron flag.'};
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
      message: `Invalid format. Usage: /reportAdd <reportName> [configJSON] [--cron <expression>]\nAvailable reports: ${getReportNames().join(', ')}`,
    };
  }

  let config: unknown;
  try {
    config = JSON.parse(configJson);
  } catch {
    return {message: 'Invalid config JSON. Provide valid JSON or omit for default config.'};
  }

  try {
    // Validate report name and config by attempting to create it
    createReport(reportName, config);

    const row = Report.create({
      userId,
      reportName,
      config: configJson,
      cron,
    });

    let message = `Report created (ID: ${row.id})\nReport: ${reportName}`;
    if (cron) {
      message += `\nSchedule: ${cron}`;
    } else {
      message += `\nSchedule: one-shot (use /reportRun ${row.id} to execute)`;
    }

    return {message, report: row};
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error creating report: ${error.message}`};
    }
    return {message: 'Error creating report'};
  }
};
