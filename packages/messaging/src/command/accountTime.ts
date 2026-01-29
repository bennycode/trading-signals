import {getExchangeClient} from '@typedtrader/exchange';
import {Account} from '../database/models/Account.js';

// Request Example: "1"
// Format: "<accountId>"
export default async (request: string, ownerAddress: string) => {
  const accountId = parseInt(request.trim(), 10);

  if (isNaN(accountId)) {
    return 'Invalid account ID';
  }

  try {
    const account = Account.findByOwnerAddressAndId(ownerAddress, accountId);

    if (!account) {
      return `Account with ID "${accountId}" not found or does not belong to you`;
    }

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
