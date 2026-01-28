import {Account} from '../database/models/Account.js';
import {getExchangeClient} from '@typedtrader/exchange';

// Request Example: "MyAlpaca Alpaca false API_KEY API_SECRET true"
// Format: "<name> <exchange> <isPaper> <apiKey> <apiSecret> <isDefault>"
export default async (request: string) => {
  const parts = request.trim().split(' ');

  if (parts.length !== 6) {
    return 'Invalid format. Usage: /accountAdd <name> <exchange> <isPaper> <apiKey> <apiSecret> <isDefault>';
  }

  const [name, exchange, isPaperStr, apiKey, apiSecret, isDefaultStr] = parts;

  const isPaper = isPaperStr.toLowerCase() === 'true';
  const isDefault = isDefaultStr.toLowerCase() === 'true';

  // Validate exchange by attempting to connect
  try {
    const client = getExchangeClient({
      exchangeId: exchange,
      apiKey,
      apiSecret,
      isPaper,
    });

    // Test connection with a timeout to avoid long waits
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000);
    });

    try {
      await Promise.race([client.getTime(), timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  } catch (error) {
    if (error instanceof Error) {
      return `Failed to connect to exchange "${exchange}": ${error.message}`;
    }
    return `Failed to connect to exchange "${exchange}"`;
  }

  try {
    if (isDefault) {
      Account.clearDefault();
    }

    const account = Account.create({
      name,
      exchange,
      isPaper,
      apiKey,
      apiSecret,
      isDefault,
    });

    return `Account created successfully with ID: ${account.id}`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error creating account: ${error.message}`;
    }
    return 'Error creating account';
  }
};
