import {ms} from 'ms';
import {Report} from '../../database/models/Report.js';

export const reportList = async (userId: string): Promise<string> => {
  try {
    const reports = Report.findByUserId(userId);

    if (reports.length === 0) {
      return 'No reports configured';
    }

    const list = reports
      .map(r => {
        const schedule = r.intervalMs ? `every ${ms(r.intervalMs, {long: true})}` : 'one-shot';
        return `ID: ${r.id} | ${r.reportName} | ${schedule}`;
      })
      .join('\n');

    return `Your reports:\n${list}`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error listing reports: ${error.message}`;
    }
    return 'Error listing reports';
  }
};
