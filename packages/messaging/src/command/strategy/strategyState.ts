import {Strategy} from '../../database/models/Strategy.js';
import {assertId} from '../../validation/assertId.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

// Request Example: "5"
export const strategyState = async (request: string, userId: string): Promise<string> => {
  try {
    const strategyId = assertId(request);
    const row = Strategy.findByPk(strategyId);

    if (!row) {
      return `Strategy with ID "${strategyId}" not found`;
    }

    getAccountOrError(userId, row.accountId);

    const header = `State for strategy "${strategyId}" (${row.strategyName} on ${row.pair}):`;

    if (!row.state) {
      return `${header}\n\n_No state persisted yet._`;
    }

    const pretty = JSON.stringify(JSON.parse(row.state), null, 2);
    return `${header}\n\n\`\`\`json\n${pretty}\n\`\`\``;
  } catch (error) {
    if (error instanceof Error) {
      return `Error loading strategy state: ${error.message}`;
    }
    return 'Error loading strategy state';
  }
};
