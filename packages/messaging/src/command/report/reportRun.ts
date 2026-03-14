// packages/messaging/src/command/report/reportRun.ts
import {createReport} from 'trading-strategies';
import {Report} from '../../database/models/Report.js';
import {assertId} from '../../validation/assertId.js';

// Format: "<reportId>"
// Example: "/reportRun 3"
export const reportRun = async (request: string, userId: string): Promise<string> => {
  try {
    const reportId = assertId(request);
    const row = Report.findByPk(reportId);

    if (!row) {
      return `Report with ID "${reportId}" not found`;
    }

    if (row.userId !== userId) {
      return `Report with ID "${reportId}" not found`;
    }

    const config = JSON.parse(row.config);
    const report = createReport(row.reportName, config);
    const result = await report.run();

    return result;
  } catch (error) {
    if (error instanceof Error) {
      return `Error running report: ${error.message}`;
    }
    return 'Error running report';
  }
};
