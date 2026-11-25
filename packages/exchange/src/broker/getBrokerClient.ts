import {AlpacaBroker} from './alpaca/AlpacaBroker.js';
import {getAlpacaClient} from './alpaca/getAlpacaClient.js';
import type {Broker} from './Broker.js';
import {IbkrBroker} from './ibkr/IbkrBroker.js';
import {getIbkrClient} from './ibkr/getIbkrClient.js';
import type {CandleFeed, MarketDataSource} from './MarketDataSource.js';
import {Trading212Broker} from './trading212/Trading212Broker.js';
import {getTrading212Client} from './trading212/getTrading212Client.js';

/**
 * A stored broker account: which broker, who it is, and what proves it.
 *
 * The credential pair is deliberately two fields rather than one blob, because every broker here
 * splits it the same way: one half names the account and can be logged or displayed, the other
 * half is the secret that must not be. What the halves are called at the broker differs — an API
 * key and its secret, a username and a password — but the roles do not, so the same pair carries
 * both and {@link BrokerAccount.apiKey} is always the identifier.
 */
export interface BrokerAccount {
  /** Which broker serves the account, i.e. one of the brokers' `NAME` constants. */
  exchangeId: string;
  /** Names the account: an API key, or a username at a broker that issues no keys. */
  apiKey: string;
  /** Proves the account: the matching API secret, or a password. Never logged or displayed. */
  apiSecret: string;
  /**
   * Trade the broker's simulated environment rather than real money.
   *
   * Every broker here offers one, but they are not reached the same way. Alpaca and Trading212
   * publish a separate endpoint, so the same credentials switch between the two. IBKR issues the
   * paper account its own username and account number and has no switch in the Web API at all, so
   * there `apiKey` and `apiSecret` have to be the paper pair and this flag is what makes a
   * mismatch an error instead of a surprise.
   */
  isPaper: boolean;
}

/** Everything a broker may need beyond the account itself, none of which every broker uses. */
export interface BrokerClientOptions {
  /**
   * Address of a local broker process, for the brokers that reach the market through one instead
   * of a vendor API over the internet. Only IBKR has one (its Client Portal Gateway); the others
   * ignore this.
   */
  gatewayUrl?: string | undefined;
  /**
   * Where candles come from, for a broker that serves none itself — Trading212 has no candle
   * endpoints and cannot work without this. Brokers that do serve their own accept it as an
   * override, which is how an instrument they have no bars for still gets a feed.
   */
  marketData?: MarketDataSource | undefined;
}

export function getBrokerClient(account: BrokerAccount, options?: BrokerClientOptions): Broker & CandleFeed {
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
       * IBKR issues no API keys: the Client Portal Gateway holds a logged-in session and signs
       * requests itself. The pair is therefore the IBKR username and password, which is what lets
       * the broker start that gateway and log in rather than requiring one somebody else brought
       * up. Both are optional, so an empty pair still talks to a running gateway.
       *
       * `paper` reaches two different things. The login page has a Live/Paper switch that a paper
       * username is refused without, so this decides which mode the gateway logs in with; and once
       * there is a session, it is the check that refuses one on the side the caller did not ask
       * for, whoever brought that session up.
       *
       * The account id is discovered from the session, and candles come from IBKR's own history
       * endpoint unless a different feed is supplied.
       */
      return getIbkrClient({
        ...(account.apiKey ? {account: account.apiKey} : {}),
        gatewayUrl: options?.gatewayUrl,
        marketData: options?.marketData,
        paper: account.isPaper,
        ...(account.apiSecret ? {password: account.apiSecret} : {}),
      });
    }
    default:
      throw new Error(`Broker "${account.exchangeId}" is not supported yet`);
  }
}
