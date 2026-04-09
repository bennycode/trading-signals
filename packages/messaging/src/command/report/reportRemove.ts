// packages/messaging/src/command/report/reportRemove.ts
import {Report} from '../../database/models/Report.js';
import {assertId} from '../../validation/assertId.js';

export interface ReportRemoveResult {
  message: string;
  reportId?: number;
}

// Format: "<reportId>"
// Example: "/reportremove 3"
export const reportRemove = async (request: string, userId: string): Promise<ReportRemoveResult> => {
  try {
    const reportId = assertId(request);
    const row = Report.findByPk(reportId);

    if (!row) {
      return {message: `Report with ID "${reportId}" not found`};
    }

    if (row.userId !== userId) {
      return {message: `Report with ID "${reportId}" not found`};
    }

    Report.destroy(reportId);

    return {
      message: `Report "${reportId}" (${row.reportName}) removed successfully`,
      reportId,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error removing report: ${error.message}`};
    }
    return {message: 'Error removing report'};
  }
};
