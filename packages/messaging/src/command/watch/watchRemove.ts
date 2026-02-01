import {Watch} from '../../database/models/Watch.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

// Request Example: "5"
export const watchRemove = async (request: string, ownerAddress: string) => {
  const watchId = parseInt(request.trim(), 10);

  if (isNaN(watchId)) {
    return 'Invalid watch ID. Usage: /watchRemove <id>';
  }

  try {
    const watch = Watch.findByPk(watchId);

    if (!watch) {
      return `Watch with ID "${watchId}" not found`;
    }

    // Security: verify the watch's account belongs to the user
    getAccountOrError(ownerAddress, watch.accountId);

    Watch.destroy(watchId);

    return `Watch "${watchId}" for ${watch.pair} removed successfully`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error removing watch: ${error.message}`;
    }
    return 'Error removing watch';
  }
};
