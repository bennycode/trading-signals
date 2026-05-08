import {AlpacaExchange} from './alpaca/AlpacaExchange.js';
import {getAlpacaClient} from './alpaca/getAlpacaClient.js';
import {Exchange} from './Exchange.js';
import {MarketDataSource} from './MarketDataSource.js';
import {Trading212Exchange} from './trading212/Trading212Exchange.js';
import {getTrading212Client} from './trading212/getTrading212Client.js';

export function getExchangeClient(
  account: {
    exchangeId: string;
    apiKey: string;
    apiSecret: string;
    isPaper: boolean;
  },
  options?: {
    /**
     * Market-data source. Required when the broker has none of its own (Trading212);
     * optional for brokers that bring one (Alpaca uses its own AlpacaMarketData by default).
     */
    marketData?: MarketDataSource;
  }
): Exchange & MarketDataSource {
  switch (account.exchangeId) {
    case AlpacaExchange.NAME:
      return getAlpacaClient({
        apiKey: account.apiKey,
        apiSecret: account.apiSecret,
        marketData: options?.marketData,
        usePaperTrading: account.isPaper,
      });
    case Trading212Exchange.NAME: {
      if (!options?.marketData) {
        throw new Error(
          `Trading212 has no market-data endpoints; pass \`options.marketData\` (e.g. an AlpacaMarketData instance constructed from separate Alpaca credentials).`
        );
      }
      return getTrading212Client({
        apiKey: account.apiKey,
        apiSecret: account.apiSecret,
        marketData: options.marketData,
        usePaperTrading: account.isPaper,
      });
    }
    default:
      throw new Error(`Exchange "${account.exchangeId}" is not supported yet`);
  }
}
