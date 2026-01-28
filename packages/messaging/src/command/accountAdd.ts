import {Account} from '../database/models/Account.js';

// Request Example: "MyAlpaca alpaca false API_KEY API_SECRET true"
// Format: "<name> <exchange> <isPaper> <apiKey> <apiSecret> <isDefault>"
export default async (request: string) => {
  const parts = request.trim().split(' ');

  if (parts.length !== 6) {
    return 'Invalid format. Usage: /accountAdd <name> <exchange> <isPaper> <apiKey> <apiSecret> <isDefault>';
  }

  const [name, exchange, isPaperStr, apiKey, apiSecret, isDefaultStr] = parts;

  // Validate required fields are not empty or whitespace-only
  if (!name.trim()) {
    return 'Invalid format. Name cannot be empty or whitespace';
  }

  if (!apiKey.trim()) {
    return 'Invalid format. API key cannot be empty or whitespace';
  }

  if (!apiSecret.trim()) {
    return 'Invalid format. API secret cannot be empty or whitespace';
  }

  const isPaper = isPaperStr.toLowerCase() === 'true';
  const isDefault = isDefaultStr.toLowerCase() === 'true';

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
