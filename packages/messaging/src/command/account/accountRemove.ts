import {Account} from '../../database/models/Account.js';
import {assertId} from '../../validation/assertId.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

// Request Example: "1"
export const accountRemove = async (request: string, userId: string) => {
  try {
    const accountId = assertId(request);
    const account = getAccountOrError(userId, accountId);
    Account.destroy(accountId);

    return `Account "${account.name}" (ID: ${accountId}) removed successfully`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error removing account: ${error.message}`;
    }
    return 'Error removing account';
  }
};
