import {TradingPair, getExchangeClient} from '@typedtrader/exchange';
import {assertId} from '../validation/assertId.js';
import {assertInterval} from '../validation/assertInterval.js';
import {getAccountOrError} from '../validation/getAccountOrError.js';

// Request Example: "1 SHOP,USD 1h"
// Format: "<accountId> <pair> <interval>"
export const candle = async (request: string, userId: string) => {
  const parts = request.trim().split(' ');

  if (parts.length !== 3) {
    return 'Invalid format. Usage: /candle <accountId> <pair> <interval>';
  }

  const [accountIdStr, pairPart, interval] = parts;

  try {
    const accountId = assertId(accountIdStr);
    const account = getAccountOrError(userId, accountId);

    const pair = TradingPair.fromString(pairPart, ',');
    const intervalInMillis = assertInterval(interval);

    const client = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });
    const candle = await client.getLatestCandle(pair, intervalInMillis);

    return JSON.stringify(candle);
  } catch (error) {
    if (error instanceof Error) {
      return `Error fetching candle: ${error.message}`;
    }
    return 'Error fetching candle';
  }
};
