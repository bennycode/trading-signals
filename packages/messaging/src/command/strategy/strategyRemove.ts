import {Strategy} from '../../database/models/Strategy.js';
import {assertId} from '../../validation/assertId.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

export interface StrategyRemoveResult {
  message: string;
  strategyId?: number;
}

// Request Example: "5"
export const strategyRemove = async (request: string, userId: string): Promise<StrategyRemoveResult> => {
  try {
    const strategyId = assertId(request);
    const row = Strategy.findByPk(strategyId);

    if (!row) {
      return {message: `Strategy with ID "${strategyId}" not found`};
    }

    // Security: verify the strategy's account belongs to the user
    getAccountOrError(userId, row.accountId);

    Strategy.destroy(strategyId);

    return {
      message: `Strategy "${strategyId}" (${row.strategyName} on ${row.pair}) removed successfully`,
      strategyId,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error removing strategy: ${error.message}`};
    }
    return {message: 'Error removing strategy'};
  }
};
