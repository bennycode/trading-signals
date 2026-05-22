import {TradingPair} from '@typedtrader/exchange';
import {getAccountBrokerClient} from '../broker/getAccountBrokerClient.js';
import {assertId} from '../validation/assertId.js';
import {getAccountOrError} from '../validation/getAccountOrError.js';

/*
 * Request Example: "1 SHOP,USD"
 * Format: "<accountId> <pair>"
 */
export const price = async (request: string, userId: string) => {
  const parts = request.trim().split(' ');

  if (parts.length !== 2) {
    return 'Invalid format. Usage: /price <accountId> <pair>';
  }

  const [accountIdStr, pairPart] = parts;

  try {
    const accountId = assertId(accountIdStr);
    const account = getAccountOrError(userId, accountId);

    const pair = TradingPair.fromString(pairPart, ',');
    const client = getAccountBrokerClient(account);

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
