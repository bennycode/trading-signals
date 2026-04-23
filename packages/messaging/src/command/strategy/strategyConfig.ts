import {Strategy} from '../../database/models/Strategy.js';
import {assertId} from '../../validation/assertId.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

// Request Example: "5"
export const strategyConfig = async (request: string, userId: string): Promise<string> => {
  try {
    const strategyId = assertId(request);
    const row = Strategy.findByPk(strategyId);

    if (!row) {
      return `Strategy with ID "${strategyId}" not found`;
    }

    getAccountOrError(userId, row.accountId);

    const header = `Config for strategy "${strategyId}" (${row.strategyName} on ${row.pair}):`;
    const pretty = JSON.stringify(JSON.parse(row.config), null, 2);
    return `${header}\n\n\`\`\`json\n${pretty}\n\`\`\``;
  } catch (error) {
    if (error instanceof Error) {
      return `Error loading strategy config: ${error.message}`;
    }
    return 'Error loading strategy config';
  }
};
