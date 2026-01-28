import {AlpacaExchange} from '../exchange-alpaca/AlpacaExchange.js';
import {getAlpacaClient} from '../exchange-alpaca/getAlpacaClient.js';
import {Exchange} from './Exchange.js';

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
    default:
      throw new Error(`Exchange "${account.exchangeId}" is not supported yet`);
  }
}
