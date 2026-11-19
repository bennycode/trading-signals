import {AlpacaBroker} from './alpaca/AlpacaBroker.js';
import {getAlpacaClient} from './alpaca/getAlpacaClient.js';
import type {Broker} from './Broker.js';
import {IbkrBroker} from './ibkr/IbkrBroker.js';
import {getIbkrClient} from './ibkr/getIbkrClient.js';
import type {CandleFeed, MarketDataSource} from './MarketDataSource.js';
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
     * Address of the IBKR Client Portal Gateway, when it is not on its default port. Ignored by
     * the other brokers, which talk to a vendor API rather than a local process.
     */
    gatewayUrl?: string;
    /**
     * Market-data source. Required only for Trading212, which has no candle endpoints. Alpaca and
     * IBKR each bring their own (`AlpacaMarketData`, `IbkrMarketData`), so passing one there just
     * overrides the default feed.
     */
    marketData?: MarketDataSource | undefined;
  }
): Broker & CandleFeed {
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
    case IbkrBroker.NAME: {
      /*
       * Unlike Alpaca and Trading212 there is no paper endpoint to switch to: the gateway serves
       * whichever account the session logged into, and this broker never asks for a paper one. A
       * caller that passed `isPaper: true` and got a live client would place real orders
       * believing it was on paper, so it is refused rather than silently ignored.
       */
      if (account.isPaper) {
        throw new Error(
          `${IbkrBroker.NAME} has no paper mode here: the Client Portal Gateway trades the account it is logged in as. Log the gateway into an IBKR paper account and pass \`isPaper: false\`, or use another broker for paper trading.`
        );
      }

      /*
       * No API key: the Client Portal Gateway holds a logged-in session and signs requests
       * itself, so `account.apiKey` / `account.apiSecret` carry nothing for this broker. The
       * account id is discovered from that session, and candles come from IBKR's own history
       * endpoint unless a different feed is supplied.
       */
      return getIbkrClient({
        gatewayUrl: options?.gatewayUrl,
        marketData: options?.marketData,
      });
    }
    default:
      throw new Error(`Broker "${account.exchangeId}" is not supported yet`);
  }
}
