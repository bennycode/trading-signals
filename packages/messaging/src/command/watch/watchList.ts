import {Account} from '../../database/models/Account.js';
import {Watch} from '../../database/models/Watch.js';
import {formatTelegramTable} from '../formatTable.js';

export const watchList = async (userId: string) => {
  try {
    const accounts = Account.findByUserId(userId);
    const accountIds = accounts.map(a => a.id);
    const watches = Watch.findByAccountIds(accountIds);

    if (watches.length === 0) {
      return 'No active watches';
    }

    return formatTelegramTable(`Active watches: ${watches.length}`, watches, [
      {header: 'ID', align: 'right', value: w => String(w.id)},
      {header: 'Pair', value: w => w.pair},
      {header: 'Baseline', value: w => w.baselinePrice},
      {
        header: 'Alert',
        value: w => {
          const dirSymbol = w.thresholdDirection === 'up' ? '+' : '-';
          const suffix = w.thresholdType === 'percent' ? '%' : '';
          return `${dirSymbol}${w.thresholdValue}${suffix} (${w.alertPrice})`;
        },
      },
      {header: 'Every', value: w => `${Math.round(w.intervalMs / 60000)}m`},
    ]);
  } catch (error) {
    if (error instanceof Error) {
      return `Error listing watches: ${error.message}`;
    }
    return 'Error listing watches';
  }
};
