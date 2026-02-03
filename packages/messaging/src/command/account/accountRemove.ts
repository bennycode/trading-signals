import {Account} from '../../database/models/Account.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

// Request Example: "1"
export const accountRemove = async (request: string, ownerAddress: string) => {
  const accountId = parseInt(request.trim(), 10);

  if (isNaN(accountId)) {
    return 'Invalid account ID. Usage: /accountRemove <id>';
  }

  try {
    const account = getAccountOrError(ownerAddress, accountId);
    Account.destroy(accountId);

    return `Account "${account.name}" (ID: ${accountId}) removed successfully`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error removing account: ${error.message}`;
    }
    return 'Error removing account';
  }
};
