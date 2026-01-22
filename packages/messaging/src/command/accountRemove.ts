import {Account} from '../database/models/Account.js';

// Request Example: "1"
export default async (request: string) => {
  const accountId = parseInt(request.trim(), 10);

  if (isNaN(accountId)) {
    return 'Invalid account ID. Usage: /accountRemove <id>';
  }

  try {
    const account = Account.findByPk(accountId);

    if (!account) {
      return `Account with ID ${accountId} not found`;
    }

    const accountName = account.name;
    Account.destroy(accountId);

    return `Account "${accountName}" (ID: ${accountId}) removed successfully`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error removing account: ${error.message}`;
    }
    return 'Error removing account';
  }
};
