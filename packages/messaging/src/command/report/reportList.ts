import {ms} from 'ms';
import {Report} from '../../database/models/Report.js';
import {formatTelegramTable} from '../formatTable.js';

export const reportList = async (userId: string): Promise<string> => {
  try {
    const reports = Report.findByUserId(userId);

    if (reports.length === 0) {
      return 'No reports configured';
    }

    return formatTelegramTable(`Your reports: ${reports.length}`, reports, [
      {header: 'ID', align: 'right', value: r => String(r.id)},
      {header: 'Report', value: r => r.reportName},
      {header: 'Schedule', value: r => (r.intervalMs ? `every ${ms(r.intervalMs, {long: true})}` : 'one-shot')},
    ]);
  } catch (error) {
    if (error instanceof Error) {
      return `Error listing reports: ${error.message}`;
    }
    return 'Error listing reports';
  }
};
