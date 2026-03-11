import {ms} from 'ms';
import {Account} from '../../database/models/Account.js';
import {Strategy} from '../../database/models/Strategy.js';

export const strategyList = async (userId: string) => {
  try {
    const accounts = Account.findByUserId(userId);
    const accountIds = accounts.map(a => a.id);
    const strategies = Strategy.findByAccountIds(accountIds);

    if (strategies.length === 0) {
      return 'No active strategies';
    }

    const list = strategies
      .map(s => {
        const intervalDisplay = ms(s.intervalMs, {long: true});
        return `ID: ${s.id} | ${s.strategyName} | ${s.pair} | Every ${intervalDisplay}`;
      })
      .join('\n');

    return `Active strategies:\n${list}`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error listing strategies: ${error.message}`;
    }
    return 'Error listing strategies';
  }
};
