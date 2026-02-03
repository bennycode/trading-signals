import {CurrencyPair, getExchangeClient, ms} from '@typedtrader/exchange';
import {getAccountOrError} from '../validation/getAccountOrError.js';

// Request Example: "1 SHOP,USD 1h"
// Format: "<accountId> <pair> <interval>"
export const candle = async (request: string, ownerAddress: string) => {
  const parts = request.trim().split(' ');

  if (parts.length !== 3) {
    return 'Invalid format. Usage: /candle <accountId> <pair> <interval>';
  }

  const [accountIdStr, pairPart, interval] = parts;
  const accountId = parseInt(accountIdStr, 10);

  if (isNaN(accountId)) {
    return 'Invalid account ID';
  }

  try {
    const account = getAccountOrError(ownerAddress, accountId);

    const pair = CurrencyPair.fromString(pairPart, ',');
    const intervalInMillis = ms(interval);

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
