import {TradingPair} from '@typedtrader/exchange';
import {getStrategyNames, createStrategy} from 'trading-strategies';
import {Strategy, type StrategyAttributes} from '../../database/models/Strategy.js';
import {assertId} from '../../validation/assertId.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

export interface StrategyAddResult {
  message: string;
  strategy?: StrategyAttributes;
}

// Request Example: "/strategyadd @typedtrader/strategy-buy-and-hold 1 SHOP,USD"
// Request Example: "/strategyadd @typedtrader/strategy-buy-once 1 SHOP,USD {"buyAt":"150"}"
// Format: "<strategyName> <accountId> <pair> [configJSON]"
export const strategyAdd = async (request: string, userId: string): Promise<StrategyAddResult> => {
  const parts = request.trim().split(' ');

  if (parts.length < 3) {
    return {
      message: `Invalid format. Usage: /strategyadd <strategyName> <accountId> <pair> [configJSON]\nExample: /strategyadd @typedtrader/strategy-buy-and-hold 1 SHOP,USD\nAvailable strategies: ${getStrategyNames().join(', ')}`,
    };
  }

  const [strategyName, accountIdStr, pairStr, ...configParts] = parts;

  // Validate pair format early
  let pair: TradingPair;
  try {
    pair = TradingPair.fromString(pairStr, ',');
  } catch {
    return {message: 'Invalid pair format. Use BASE,COUNTER (e.g., SHOP,USD).'};
  }

  const configJson = configParts.length > 0 ? configParts.join(' ') : '{}';
  let config: unknown;
  try {
    config = JSON.parse(configJson);
  } catch {
    return {message: 'Invalid config JSON. Provide valid JSON or omit for default config.'};
  }

  try {
    const accountId = assertId(accountIdStr);
    const account = getAccountOrError(userId, accountId);

    // Validate strategy name and config by attempting to create it
    createStrategy(strategyName, config);

    const pairString = pair.asString(',');
    const row = Strategy.create({
      accountId: account.id,
      strategyName,
      config: configJson,
      pair: pairString,
    });

    return {
      message: `Strategy created (ID: ${row.id})\nStrategy: ${strategyName}\nPair: ${pairString}\nAccount: ${account.name}`,
      strategy: row,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error creating strategy: ${error.message}`};
    }
    return {message: 'Error creating strategy'};
  }
};
