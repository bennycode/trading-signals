import {Account} from '../database/models/Account.js';
import {Watch} from '../database/models/Watch.js';

export default async (ownerAddress: string) => {
  try {
    const accounts = Account.findByOwnerAddress(ownerAddress);
    const accountIds = accounts.map(a => a.id);
    const watches = Watch.findByAccountIds(accountIds);

    if (watches.length === 0) {
      return 'No active watches';
    }

    const watchList = watches
      .map(w => {
        const dirSymbol = w.thresholdDirection === 'up' ? '+' : '-';
        const thresholdDisplay =
          w.thresholdType === 'percent' ? `${dirSymbol}${w.thresholdValue}%` : `${dirSymbol}${w.thresholdValue}`;
        const intervalMin = Math.round(w.intervalMs / 60000);
        return `ID: ${w.id} | ${w.pair} | Baseline: ${w.baselinePrice} | Alert: ${thresholdDisplay} | Every ${intervalMin}m`;
      })
      .join('\n');

    return `Active watches:\n${watchList}`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error listing watches: ${error.message}`;
    }
    return 'Error listing watches';
  }
};
