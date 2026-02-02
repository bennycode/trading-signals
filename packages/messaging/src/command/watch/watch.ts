import {CurrencyPair, getExchangeClient, ms} from '@typedtrader/exchange';
import {Watch, WatchAttributes} from '../../database/models/Watch.js';
import {parseThreshold} from '../../validation/parseThreshold.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

export interface WatchResult {
  message: string;
  watch?: WatchAttributes;
}

// Request Example: "/watch SHOP,USD 1 1m +5%"
// Format: "<pair> <accountId> <interval> <threshold>"
export const watch = async (request: string, ownerAddress: string): Promise<WatchResult> => {
  const parts = request.trim().split(' ');

  if (parts.length !== 4) {
    return {message: 'Invalid format. Usage: /watch <pair> <accountId> <interval> <threshold>\nExample: /watch SHOP,USD 1 1m +5%'};
  }

  const [pairPart, accountIdStr, interval, thresholdStr] = parts;
  const accountId = parseInt(accountIdStr, 10);

  if (isNaN(accountId)) {
    return {message: 'Invalid account ID'};
  }

  const threshold = parseThreshold(thresholdStr);
  if (!threshold) {
    return {message: 'Invalid threshold format. Use: +5%, -10%, +100, -50 (percentage or absolute value)'};
  }

  try {
    const account = getAccountOrError(ownerAddress, accountId);

    const pair = CurrencyPair.fromString(pairPart, ',');
    const {counter} = pair;

    // Parse interval
    const intervalMs = ms(interval);
    if (!intervalMs || intervalMs < 60000) {
      return {message: 'Invalid interval. Minimum is 1m (1 minute). Examples: 1m, 5m, 1h'};
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
    const createdWatch = Watch.create({
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

    return {
      message: `Watch created (ID: ${createdWatch.id})\nPair: ${pairPart}\nBaseline: ${baselinePrice} ${counter}\nAlert when: ${thresholdDisplay}\nCheck interval: ${interval}`,
      watch: createdWatch,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error creating watch: ${error.message}`};
    }
    return {message: 'Error creating watch'};
  }
};
