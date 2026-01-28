import {CurrencyPair, getExchangeClient} from '@typedtrader/exchange';
import {Account} from '../database/models/Account.js';

// Request Example: "1 SHOP,USD"
// Format: "<accountId> <pair>"
export default async (request: string) => {
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
    const account = Account.findByPk(accountId);

    if (!account) {
      return `Account with ID "${accountId}" not found`;
    }

    const commaIndex = pairPart.indexOf(',');

    if (commaIndex === -1) {
      return 'Invalid pair format. Use: BASE,COUNTER (e.g., SHOP,USD)';
    }

    const base = pairPart.slice(0, commaIndex);
    const counter = pairPart.slice(commaIndex + 1);
    const pair = new CurrencyPair(base, counter);

    const client = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });

    const smallestInterval = client.getSmallestInterval();
    const candle = await client.getLatestAvailableCandle(pair, smallestInterval);

    return `${pair.base}/${pair.counter}: ${candle.close}`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error fetching price: ${error.message}`;
    }
    return 'Error fetching price';
  }
};
