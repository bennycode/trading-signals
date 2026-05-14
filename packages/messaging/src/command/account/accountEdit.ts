import {getBrokerClient} from '@typedtrader/exchange';
import {Account} from '../../database/models/Account.js';
import {assertId} from '../../validation/assertId.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

// Request Example: "1 API_KEY API_SECRET"
// Format: "<id> <apiKey> <apiSecret>"
export async function accountEdit(request: string, userId: string) {
  const parts = request.trim().split(' ');

  if (parts.length !== 3) {
    return 'Invalid format. Usage: /accountEdit <id> <apiKey> <apiSecret>';
  }

  const [idStr, apiKey, apiSecret] = parts;

  try {
    const accountId = assertId(idStr);
    // Keeps the account ID, name, exchange and isPaper mode (and therefore all linked
    // watches, strategies and reports) — only the credentials are replaced.
    const account = getAccountOrError(userId, accountId);

    const client = getBrokerClient({
      exchangeId: account.exchange,
      apiKey,
      apiSecret,
      isPaper: account.isPaper,
    });
    await client.getTime();

    Account.update(accountId, {apiKey, apiSecret});

    return `Account "${account.name}" (ID: ${accountId}) updated successfully. Connection test passed.`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error updating account: ${error.message}`;
    }
    return 'Error updating account';
  }
}
