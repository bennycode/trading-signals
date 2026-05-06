import {AlpacaExchange} from './alpaca/AlpacaExchange.js';
import {getAlpacaClient} from './alpaca/getAlpacaClient.js';
import {Exchange} from './Exchange.js';
import {Trading212Exchange} from './trading212/Trading212Exchange.js';
import {getTrading212Client} from './trading212/getTrading212Client.js';

export function getExchangeClient(account: {
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  isPaper: boolean;
}): Exchange {
  switch (account.exchangeId) {
    case AlpacaExchange.NAME:
      return getAlpacaClient({
        apiKey: account.apiKey,
        apiSecret: account.apiSecret,
        usePaperTrading: account.isPaper,
      });
    case Trading212Exchange.NAME:
      return getTrading212Client({
        apiKey: account.apiKey,
        usePaperTrading: account.isPaper,
      });
    default:
      throw new Error(`Exchange "${account.exchangeId}" is not supported yet`);
  }
}
