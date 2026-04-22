import {Account} from '../../database/models/Account.js';
import {Strategy} from '../../database/models/Strategy.js';
import {formatTelegramTable} from '../formatTable.js';

export const strategyList = async (userId: string) => {
  try {
    const accounts = Account.findByUserId(userId);
    const accountIds = accounts.map(a => a.id);
    const strategies = Strategy.findByAccountIds(accountIds);

    if (strategies.length === 0) {
      return 'No active strategies';
    }

    return formatTelegramTable(`Active strategies: ${strategies.length}`, strategies, [
      {header: 'ID', align: 'right', value: s => String(s.id)},
      {header: 'Strategy', value: s => s.strategyName},
      {header: 'Pair', value: s => s.pair},
    ]);
  } catch (error) {
    if (error instanceof Error) {
      return `Error listing strategies: ${error.message}`;
    }
    return 'Error listing strategies';
  }
};
