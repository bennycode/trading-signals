import {getExchangeClient} from '@typedtrader/exchange';
import {Account} from '../database/models/Account.js';

interface ValidateClientConfig {
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  isPaper: boolean;
}

async function validateClient(config: ValidateClientConfig) {
  const client = getExchangeClient(config);
  await client.getTime();
}

// Request Example: "MyAlpaca alpaca false API_KEY API_SECRET"
// Format: "<name> <exchange> <isPaper> <apiKey> <apiSecret>"
export default async (request: string, ownerAddress: string) => {
  const parts = request.trim().split(' ');

  if (parts.length !== 5) {
    return 'Invalid format. Usage: /accountAdd <name> <exchange> <isPaper> <apiKey> <apiSecret>';
  }

  const [name, exchange, isPaperStr, apiKey, apiSecret] = parts;

  const isPaper = isPaperStr.toLowerCase() === 'true';

  try {
    await validateClient({exchangeId: exchange, apiKey, apiSecret, isPaper});

    const account = Account.create({
      ownerAddress,
      name,
      exchange,
      isPaper,
      apiKey,
      apiSecret,
    });

    return `Account created successfully with ID: ${account.id}`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error creating account: ${error.message}`;
    }
    return 'Error creating account';
  }
};
