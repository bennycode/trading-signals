import {TradingPair} from '@typedtrader/exchange';
import {createStrategy} from 'trading-strategies';
import {Strategy, type StrategyAttributes} from '../../database/models/Strategy.js';
import {assertId} from '../../validation/assertId.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

export interface StrategyCopyResult {
  message: string;
  strategy?: StrategyAttributes;
}

/*
 * Chat command example: "/strategyCopy 5 2 BTC,USD"
 * The MessagingPlatform strips the command name, so `request` only contains the args.
 * Args format: "<sourceStrategyId> <targetAccountId> <targetPair>"
 * Args example: "5 2 BTC,USD"
 */
export const strategyCopy = async (request: string, userId: string): Promise<StrategyCopyResult> => {
  const parts = request.trim().split(/\s+/).filter(Boolean);

  if (parts.length !== 3) {
    return {
      message:
        'Invalid format. Usage: /strategyCopy <sourceStrategyId> <targetAccountId> <targetPair>\nExample: /strategyCopy 5 2 BTC,USD',
    };
  }

  const [sourceIdStr, targetAccountIdStr, pairStr] = parts;

  let pair: TradingPair;
  try {
    pair = TradingPair.fromString(pairStr, ',');
  } catch {
    return {message: 'Invalid pair format. Use BASE,COUNTER (e.g., BTC,USD).'};
  }

  try {
    const sourceId = assertId(sourceIdStr);
    const source = Strategy.findByPk(sourceId);

    if (!source) {
      return {message: `Strategy with ID "${sourceId}" not found`};
    }

    /*
     * Security: verify the source strategy's account belongs to the user
     * before exposing its config to a copy operation.
     */
    getAccountOrError(userId, source.accountId);

    const targetAccountId = assertId(targetAccountIdStr);
    const targetAccount = getAccountOrError(userId, targetAccountId);

    /*
     * Validate the source strategy is still instantiable before persisting a copy
     * that StrategyMonitor would otherwise fail to start.
     */
    let parsedConfig: unknown;
    try {
      parsedConfig = JSON.parse(source.config);
    } catch {
      return {message: `Source strategy ${sourceId} has invalid config JSON and cannot be copied.`};
    }
    createStrategy(source.strategyName, parsedConfig);

    const pairString = pair.asString(',');
    const row = Strategy.create({
      accountId: targetAccount.id,
      config: source.config,
      pair: pairString,
      strategyName: source.strategyName,
    });

    return {
      message: `Strategy copied (ID: ${row.id})\nSource: ${sourceId} (${source.strategyName} on ${source.pair})\nStrategy: ${source.strategyName}\nPair: ${pairString}\nAccount: ${targetAccount.name}`,
      strategy: row,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error copying strategy: ${error.message}`};
    }
    return {message: 'Error copying strategy'};
  }
};
