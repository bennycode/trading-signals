import {Account} from '../database/models/Account.js';

// Request Example: "MyAlpaca alpaca false API_KEY API_SECRET"
// Format: "<name> <exchange> <isPaper> <apiKey> <apiSecret>"
export default async (request: string) => {
  const parts = request.trim().split(' ');

  if (parts.length !== 5) {
    return 'Invalid format. Usage: /accountAdd <name> <exchange> <isPaper> <apiKey> <apiSecret>';
  }

  const [name, exchange, isPaperStr, apiKey, apiSecret] = parts;

  const isPaper = isPaperStr.toLowerCase() === 'true';

  try {
    const account = Account.create({
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
