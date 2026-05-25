import {Account} from '../../database/models/Account.js';
import {formatTelegramTable} from '../formatTable.js';

export const accountList = async (userId: string) => {
  try {
    const accounts = Account.findByUserId(userId);

    if (accounts.length === 0) {
      return 'No accounts found';
    }

    return formatTelegramTable(`Accounts: ${accounts.length}`, accounts, [
      {align: 'right', header: 'ID', value: acc => String(acc.id)},
      {header: 'Name', value: acc => acc.name},
      {header: 'Broker', value: acc => acc.exchange},
      {header: 'Mode', value: acc => (acc.isPaper ? 'Paper' : 'Live')},
    ]);
  } catch (error) {
    if (error instanceof Error) {
      return `Error listing accounts: ${error.message}`;
    }
    return 'Error listing accounts';
  }
};
