import {getAuthenticatedBrokerClient} from '@typedtrader/exchange';
import {buildMarketDataFromAccount} from '../../broker/getAccountBrokerClient.js';
import {Account} from '../../database/models/Account.js';
import {assertId} from '../../validation/assertId.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

interface AccountEditResult {
  message: string;
  /** Set only on success — signals the caller to restart the account's running sessions. */
  accountId?: number;
}

/*
 * Request Example: "1 API_KEY API_SECRET"
 * Format: "<id> <apiKey> <apiSecret>"
 */
export async function accountEdit(request: string, userId: string): Promise<AccountEditResult> {
  const parts = request.trim().split(' ');

  if (parts.length !== 3) {
    return {message: 'Invalid format. Usage: /accountEdit <id> <apiKey> <apiSecret>'};
  }

  const [idStr, apiKey, apiSecret] = parts;

  try {
    const accountId = assertId(idStr);
    const account = getAccountOrError(userId, accountId);

    /*
     * Resolve the existing data source so feed-less brokers (e.g. Trading212) can be
     * validated; account.marketDataAccountId is unchanged by an edit.
     */
    let marketData;
    if (account.marketDataAccountId !== null) {
      const source = Account.findByUserIdAndId(userId, account.marketDataAccountId);
      if (!source) {
        return {message: `Market-data account (ID: ${account.marketDataAccountId}) was not found.`};
      }
      marketData = buildMarketDataFromAccount(source);
    }

    await getAuthenticatedBrokerClient(
      {
        apiKey,
        apiSecret,
        exchangeId: account.exchange,
        isPaper: account.isPaper,
      },
      marketData ? {marketData} : undefined
    );

    Account.update(accountId, {apiKey, apiSecret});

    return {
      accountId,
      message: `Account "${account.name}" (ID: ${accountId}) updated successfully. Connection test passed.`,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error updating account: ${error.message}`};
    }
    return {message: 'Error updating account'};
  }
}
