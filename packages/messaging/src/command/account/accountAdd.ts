import {getAuthenticatedBrokerClient} from '@typedtrader/exchange';
import {buildMarketDataFromAccount} from '../../broker/getAccountBrokerClient.js';
import {Account} from '../../database/models/Account.js';

// Request Example: "MyAlpaca alpaca false API_KEY API_SECRET"
// Trading212 example (last arg references an existing account for market data):
//   "MyT212 Trading212 true API_KEY API_SECRET 1"
// Format: "<name> <exchange> <isPaper> <apiKey> <apiSecret> [marketDataAccountId]"
export async function accountAdd(request: string, userId: string) {
  const parts = request.trim().split(' ');

  if (parts.length !== 5 && parts.length !== 6) {
    return 'Invalid format. Usage: /accountAdd <name> <exchange> <isPaper> <apiKey> <apiSecret> [marketDataAccountId]';
  }

  const [name, exchange, isPaperStr, apiKey, apiSecret, marketDataAccountIdStr] = parts;

  const isPaper = isPaperStr.toLowerCase() === 'true';

  try {
    let marketData;
    let marketDataAccountId: number | null = null;
    if (marketDataAccountIdStr !== undefined) {
      marketDataAccountId = Number(marketDataAccountIdStr);
      if (!Number.isInteger(marketDataAccountId)) {
        return 'Invalid marketDataAccountId — it must be a numeric account ID.';
      }
      const source = Account.findByUserIdAndId(userId, marketDataAccountId);
      if (!source) {
        return `Market-data account (ID: ${marketDataAccountId}) was not found.`;
      }
      // The data source must run in the same mode (paper/live): Alpaca serves data from
      // different environments and keys per mode, so the pairing must match.
      if (source.isPaper !== isPaper) {
        return `Market-data account (ID: ${marketDataAccountId}) is ${source.isPaper ? 'Paper' : 'Live'}, but this account is ${isPaper ? 'Paper' : 'Live'}. The data source must run in the same mode.`;
      }
      marketData = buildMarketDataFromAccount(source);
    }

    await getAuthenticatedBrokerClient(
      {exchangeId: exchange, apiKey, apiSecret, isPaper},
      marketData ? {marketData} : undefined
    );

    const account = Account.create({
      userId,
      name,
      exchange,
      isPaper,
      apiKey,
      apiSecret,
      marketDataAccountId,
    });

    return `Account created successfully with ID "${account.id}". Connection test passed.`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error creating account: ${error.message}`;
    }
    return 'Error creating account';
  }
}
