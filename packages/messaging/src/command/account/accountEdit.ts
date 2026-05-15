import {getAuthenticatedBrokerClient} from '@typedtrader/exchange';
import {Account} from '../../database/models/Account.js';
import {assertId} from '../../validation/assertId.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

interface AccountEditResult {
  message: string;
  /** Set only on success — signals the caller to restart the account's running sessions. */
  accountId?: number;
}

// Request Example: "1 API_KEY API_SECRET"
// Format: "<id> <apiKey> <apiSecret>"
export async function accountEdit(request: string, userId: string): Promise<AccountEditResult> {
  const parts = request.trim().split(' ');

  if (parts.length !== 3) {
    return {message: 'Invalid format. Usage: /accountEdit <id> <apiKey> <apiSecret>'};
  }

  const [idStr, apiKey, apiSecret] = parts;

  try {
    const accountId = assertId(idStr);
    const account = getAccountOrError(userId, accountId);

    await getAuthenticatedBrokerClient({
      exchangeId: account.exchange,
      apiKey,
      apiSecret,
      isPaper: account.isPaper,
    });

    Account.update(accountId, {apiKey, apiSecret});

    return {
      message: `Account "${account.name}" (ID: ${accountId}) updated successfully. Connection test passed.`,
      accountId,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error updating account: ${error.message}`};
    }
    return {message: 'Error updating account'};
  }
}
