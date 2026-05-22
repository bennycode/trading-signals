import {AlpacaBroker, AlpacaMarketData, getBrokerClient, type Broker, type MarketDataSource} from '@typedtrader/exchange';
import {Account, type AccountAttributes} from '../database/models/Account.js';

/**
 * Build a `MarketDataSource` from an account's stored credentials. Only brokers that expose
 * historical bars / a candle stream qualify; others throw so the caller surfaces a clear error
 * instead of constructing a broker that will fail later on a candle call.
 *
 * Cheap to call repeatedly: this returns a fresh `AlpacaMarketData` wrapper, but the wrapper
 * does NOT own a socket. The actual WebSocket lives in the process-global `alpacaWebSocket`
 * singleton, which dedupes by `${apiKey}:${source}`. So a Trading212 account that references
 * the same Alpaca account the user added directly shares one socket per source (Alpaca allows
 * only one connection per API key), rather than opening a second one and tripping its
 * "connection limit exceeded" (406) error.
 */
export function buildMarketDataFromAccount(source: AccountAttributes): MarketDataSource {
  switch (source.exchange) {
    case AlpacaBroker.NAME:
      return new AlpacaMarketData({
        apiKey: source.apiKey,
        apiSecret: source.apiSecret,
        usePaperTrading: source.isPaper,
      });
    default:
      throw new Error(
        `Account "${source.name}" (${source.exchange}) cannot be used as a market-data source — it has no market-data feed.`
      );
  }
}

/**
 * Resolve the market-data source referenced by an account, if any. Brokers without their own
 * feed (e.g. Trading212) point at another account via `marketDataAccountId`; this loads that
 * account (enforcing the same-user ownership rule) and turns it into a `MarketDataSource`.
 */
function resolveMarketData(account: AccountAttributes): MarketDataSource | undefined {
  // Explicitly check null (DB default) and undefined (legacy rows / test fixtures) so a
  // stray 0 / NaN isn't silently treated as "no data source" — it falls through to the
  // lookup below and surfaces a targeted "not found" error instead.
  if (account.marketDataAccountId === null || account.marketDataAccountId === undefined) {
    return undefined;
  }

  const source = Account.findByUserIdAndId(account.userId, account.marketDataAccountId);
  if (!source) {
    throw new Error(
      `Market-data source account (ID: ${account.marketDataAccountId}) for "${account.name}" was not found. Re-add the account with a valid data source.`
    );
  }

  return buildMarketDataFromAccount(source);
}

/**
 * Build a broker client for a stored account, wiring in an external market-data source when the
 * broker needs one. Use this everywhere instead of calling `getBrokerClient` directly with raw
 * credentials, so Trading212 (and any other feed-less broker) gets its data source resolved.
 */
export function getAccountBrokerClient(account: AccountAttributes): Broker & MarketDataSource {
  const marketData = resolveMarketData(account);
  return getBrokerClient(
    {
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    },
    marketData ? {marketData} : undefined
  );
}
