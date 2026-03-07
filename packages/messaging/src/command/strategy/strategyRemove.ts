import {Strategy} from '../../database/models/Strategy.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

export interface StrategyRemoveResult {
  message: string;
  strategyId?: number;
}

// Request Example: "5"
export const strategyRemove = async (request: string, ownerAddress: string): Promise<StrategyRemoveResult> => {
  const strategyId = parseInt(request.trim(), 10);

  if (isNaN(strategyId)) {
    return {message: 'Invalid strategy ID. Usage: /strategyRemove <id>'};
  }

  try {
    const row = Strategy.findByPk(strategyId);

    if (!row) {
      return {message: `Strategy with ID "${strategyId}" not found`};
    }

    // Security: verify the strategy's account belongs to the user
    getAccountOrError(ownerAddress, row.accountId);

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
