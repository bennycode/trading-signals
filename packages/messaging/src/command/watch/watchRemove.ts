import {Watch} from '../../database/models/Watch.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

export interface WatchRemoveResult {
  message: string;
  watchId?: number;
}

// Request Example: "5"
export const watchRemove = async (request: string, ownerAddress: string): Promise<WatchRemoveResult> => {
  const watchId = parseInt(request.trim(), 10);

  if (isNaN(watchId)) {
    return {message: 'Invalid watch ID. Usage: /watchRemove <id>'};
  }

  try {
    const watch = Watch.findByPk(watchId);

    if (!watch) {
      return {message: `Watch with ID "${watchId}" not found`};
    }

    // Security: verify the watch's account belongs to the user
    getAccountOrError(ownerAddress, watch.accountId);

    Watch.destroy(watchId);

    return {
      message: `Watch "${watchId}" for ${watch.pair} removed successfully`,
      watchId,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error removing watch: ${error.message}`};
    }
    return {message: 'Error removing watch'};
  }
};
