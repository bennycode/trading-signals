import {Account} from '../database/models/Account.js';
import {AlpacaExchange} from '@typedtrader/exchange';

// Supported exchanges
const SUPPORTED_EXCHANGES = [AlpacaExchange.NAME];

// Request Example: "MyAlpaca Alpaca false API_KEY API_SECRET true"
// Format: "<name> <exchange> <isPaper> <apiKey> <apiSecret> <isDefault>"
export default async (request: string) => {
  const parts = request.trim().split(' ');

  if (parts.length !== 6) {
    return 'Invalid format. Usage: /accountAdd <name> <exchange> <isPaper> <apiKey> <apiSecret> <isDefault>';
  }

  const [name, exchangeInput, isPaperStr, apiKey, apiSecret, isDefaultStr] = parts;

  const isPaper = isPaperStr.toLowerCase() === 'true';
  const isDefault = isDefaultStr.toLowerCase() === 'true';

  // Validate exchange (case-insensitive)
  const exchange = SUPPORTED_EXCHANGES.find(ex => ex.toLowerCase() === exchangeInput.toLowerCase());

  if (!exchange) {
    return `Invalid exchange "${exchangeInput}". Supported exchanges: ${SUPPORTED_EXCHANGES.join(', ')}`;
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
