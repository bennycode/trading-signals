import {CurrencyPair, getExchangeClient, ms} from '@typedtrader/exchange';
import {Account} from '../database/models/Account.js';
import {Watch} from '../database/models/Watch.js';
import {parseThreshold} from '../util/parseThreshold.js';

// Request Example: "/watch SHOP,USD 1 1m +5%"
// Format: "<pair> <accountId> <interval> <threshold>"
export const watch = async (request: string, ownerAddress: string) => {
  const parts = request.trim().split(' ');

  if (parts.length !== 4) {
    return 'Invalid format. Usage: /watch <pair> <accountId> <interval> <threshold>\nExample: /watch SHOP,USD 1 1m +5%';
  }

  const [pairPart, accountIdStr, interval, thresholdStr] = parts;
  const accountId = parseInt(accountIdStr, 10);

  if (isNaN(accountId)) {
    return 'Invalid account ID';
  }

  const threshold = parseThreshold(thresholdStr);
  if (!threshold) {
    return 'Invalid threshold format. Use: +5%, -10%, +100, -50 (percentage or absolute value)';
  }

  try {
    const account = Account.findByOwnerAddressAndId(ownerAddress, accountId);
    if (!account) {
      return `Account with ID "${accountId}" not found or does not belong to you`;
    }

    // Parse pair
    const commaIndex = pairPart.indexOf(',');
    if (commaIndex === -1) {
      return 'Invalid pair format. Use: BASE,COUNTER (e.g., SHOP,USD)';
    }

    const base = pairPart.slice(0, commaIndex);
    const counter = pairPart.slice(commaIndex + 1);
    const pair = new CurrencyPair(base, counter);

    // Parse interval
    const intervalMs = ms(interval);
    if (!intervalMs || intervalMs < 60000) {
      return 'Invalid interval. Minimum is 1m (1 minute). Examples: 1m, 5m, 1h';
    }

    // Fetch current price as baseline
    const client = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });

    const smallestInterval = client.getSmallestInterval();
    const candle = await client.getLatestCandle(pair, smallestInterval);
    const baselinePrice = candle.close;

    // Create watch
    const watch = Watch.create({
      accountId,
      pair: pairPart,
      intervalMs,
      thresholdType: threshold.type,
      thresholdDirection: threshold.direction,
      thresholdValue: threshold.value.toString(),
      baselinePrice: baselinePrice.toString(),
    });

    const directionSymbol = threshold.direction === 'up' ? '+' : '-';
    const thresholdDisplay =
      threshold.type === 'percent'
        ? `${directionSymbol}${threshold.value}%`
        : `${directionSymbol}${threshold.value} ${counter}`;

    return `Watch created (ID: ${watch.id})\nPair: ${pairPart}\nBaseline: ${baselinePrice} ${counter}\nAlert when: ${thresholdDisplay}\nCheck interval: ${interval}`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error creating watch: ${error.message}`;
    }
    return 'Error creating watch';
  }
};
