import {getExchangeClient} from '@typedtrader/exchange';
import {assertId} from '../../validation/assertId.js';
import {getAccountOrError} from '../../validation/getAccountOrError.js';

// Request Example: "1"
// Format: "<accountId>"
export const accountTime = async (request: string, ownerAddress: string) => {
  try {
    const accountId = assertId(request);
    const account = getAccountOrError(ownerAddress, accountId);

    const client = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });
    const time = await client.getTime();

    return `Exchange time: ${time}`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error fetching time: ${error.message}`;
    }
    return 'Error fetching time';
  }
};
