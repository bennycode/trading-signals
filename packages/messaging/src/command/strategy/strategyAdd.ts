import {getExchangeClient} from '@typedtrader/exchange';
import {ms} from 'ms';
import {getStrategyNames, createStrategy} from 'trading-strategies';
import {Strategy, type StrategyAttributes} from '../../database/models/Strategy.js';
import {assertId} from '../../validation/assertId.js';
import {assertInterval} from '../../validation/assertInterval.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

export interface StrategyAddResult {
  message: string;
  strategy?: StrategyAttributes;
}

// Request Example: "/strategyAdd @typedtrader/strategy-buy-and-hold 1 SHOP,USD 1m"
// Request Example: "/strategyAdd @typedtrader/strategy-buy-once 1 SHOP,USD 1m {"buyAt":"150"}"
// Format: "<strategyName> <accountId> <pair> <interval> [configJSON]"
export const strategyAdd = async (request: string, ownerAddress: string): Promise<StrategyAddResult> => {
  const parts = request.trim().split(' ');

  if (parts.length < 4) {
    return {
      message: `Invalid format. Usage: /strategyAdd <strategyName> <accountId> <pair> <interval> [configJSON]\nExample: /strategyAdd @typedtrader/strategy-buy-and-hold 1 SHOP,USD 1m\nAvailable strategies: ${getStrategyNames().join(', ')}`,
    };
  }

  const [strategyName, accountIdStr, pair, interval, ...configParts] = parts;
  const accountId = assertId(accountIdStr);
  const intervalMs = assertInterval(interval);

  const configJson = configParts.length > 0 ? configParts.join(' ') : '{}';
  let config: unknown;
  try {
    config = JSON.parse(configJson);
  } catch {
    return {message: 'Invalid config JSON. Provide valid JSON or omit for default config.'};
  }

  try {
    const account = getAccountOrError(ownerAddress, accountId);

    const client = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });

    const smallestInterval = client.getSmallestInterval();
    if (intervalMs < smallestInterval) {
      return {message: `Invalid interval. Minimum for ${account.exchange} is ${ms(smallestInterval, {long: true})}.`};
    }

    // Validate strategy name and config by attempting to create it
    createStrategy(strategyName, config);

    const row = Strategy.create({
      accountId: account.id,
      strategyName,
      config: configJson,
      pair,
      intervalMs,
    });

    return {
      message: `Strategy created (ID: ${row.id})\nStrategy: ${strategyName}\nPair: ${pair}\nInterval: ${interval}\nAccount: ${account.name}`,
      strategy: row,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error creating strategy: ${error.message}`};
    }
    return {message: 'Error creating strategy'};
  }
};
