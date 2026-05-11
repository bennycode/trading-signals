import {AlpacaBroker} from './alpaca/AlpacaBroker.js';
import {getAlpacaClient} from './alpaca/getAlpacaClient.js';
import {Broker} from './Broker.js';
import {MarketDataSource} from './MarketDataSource.js';
import {Trading212Broker} from './trading212/Trading212Broker.js';
import {getTrading212Client} from './trading212/getTrading212Client.js';

export function getBrokerClient(
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
): Broker & MarketDataSource {
  switch (account.exchangeId) {
    case AlpacaBroker.NAME:
      return getAlpacaClient({
        apiKey: account.apiKey,
        apiSecret: account.apiSecret,
        marketData: options?.marketData,
        usePaperTrading: account.isPaper,
      });
    case Trading212Broker.NAME: {
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
      throw new Error(`Broker "${account.exchangeId}" is not supported yet`);
  }
}
