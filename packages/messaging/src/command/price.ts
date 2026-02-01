import {getExchangeClient} from '@typedtrader/exchange';
import {getAccountOrError} from '../validation/getAccountOrError.js';
import {parsePair} from '../validation/parsePair.js';

// Request Example: "1 SHOP,USD"
// Format: "<accountId> <pair>"
export const price = async (request: string, ownerAddress: string) => {
  const parts = request.trim().split(' ');

  if (parts.length !== 2) {
    return 'Invalid format. Usage: /price <accountId> <pair>';
  }

  const [accountIdStr, pairPart] = parts;
  const accountId = parseInt(accountIdStr, 10);

  if (isNaN(accountId)) {
    return 'Invalid account ID';
  }

  try {
    const account = getAccountOrError(ownerAddress, accountId);

    const pair = parsePair(pairPart);
    if (!pair) {
      return 'Invalid pair format. Use: BASE,COUNTER (e.g., SHOP,USD)';
    }

    const client = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });

    const smallestInterval = client.getSmallestInterval();
    const candle = await client.getLatestCandle(pair, smallestInterval);

    return `Closing price of "${pair.base}": ${candle.close} ${pair.counter} (${candle.openTimeInISO})`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error fetching price: ${error.message}`;
    }
    return 'Error fetching price';
  }
};
