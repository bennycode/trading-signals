import {Account} from '../database/models/Account.js';

export default async () => {
  try {
    const accounts = Account.findAll({
      attributes: ['id', 'name', 'exchange', 'isPaper', 'isDefault'],
      order: [['id', 'ASC']],
    });

    if (accounts.length === 0) {
      return 'No accounts found';
    }

    const accountList = accounts
      .map(
        acc =>
          `ID: ${acc.id} | ${acc.name} | ${acc.exchange} | ${acc.isPaper ? 'Paper' : 'Live'} ${acc.isDefault ? '(Default)' : ''}`
      )
      .join('\n');

    return `Accounts:\n${accountList}`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error listing accounts: ${error.message}`;
    }
    return 'Error listing accounts';
  }
};
