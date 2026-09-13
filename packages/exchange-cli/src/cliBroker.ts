import {
  AlpacaAPI,
  AlpacaAssetClass,
  MarketDataSource,
  Trading212API,
  Trading212Broker,
  getBrokerClient,
  type Candle,
} from '@typedtrader/exchange';

export const BROKERS = {
  alpaca: {id: 'Alpaca', pollInterval: 5_000},
  trading212: {id: 'Trading212', pollInterval: Trading212Broker.ORDER_POLL_INTERVAL_MS},
} as const;

export type BrokerKey = keyof typeof BROKERS;

export interface Instrument {
  currency: string;
  isin?: string;
  name: string;
  ticker: string;
}

/*
 * Trading212's factory requires a data source even for account/order commands. Keep this
 * CLI adapter explicit: cross-provider symbol mapping is outside the command-line layer.
 */
class UnavailableMarketData extends MarketDataSource {
  static readonly REASON = 'Trading212 market data is not configured in this CLI. Use --broker alpaca for market data.';

  async getCandles(): Promise<Candle[]> {
    throw new Error(UnavailableMarketData.REASON);
  }

  async getLatestCandle(): Promise<Candle> {
    throw new Error(UnavailableMarketData.REASON);
  }

  async watchCandles(): Promise<string> {
    throw new Error(UnavailableMarketData.REASON);
  }

  unwatchCandles(): void {}
  disconnect(): void {}
}

/** Uses the existing PAPER/LIVE credential names; loading env files belongs to the caller. */
export function createCliBroker(key: BrokerKey, live: boolean, env: NodeJS.ProcessEnv) {
  const prefix = `${key.toUpperCase()}_${live ? 'LIVE' : 'PAPER'}`;
  const apiKey = env[`${prefix}_API_KEY`];
  const apiSecret = env[`${prefix}_API_SECRET`];
  if (!apiKey || !apiSecret) {
    throw new Error(`Missing ${prefix}_API_KEY and/or ${prefix}_API_SECRET in environment.`);
  }

  const options = {apiKey, apiSecret, usePaperTrading: !live};
  const broker = getBrokerClient(
    {apiKey, apiSecret, exchangeId: BROKERS[key].id, isPaper: !live},
    key === 'trading212' ? {marketData: new UnavailableMarketData()} : undefined
  );

  // Instrument discovery is not part of Broker; adapt the existing REST methods here.
  const listInstruments = async (): Promise<Instrument[]> => {
    if (key === 'trading212') {
      return (await new Trading212API(options).getInstruments()).map(instrument => ({
        currency: instrument.currencyCode,
        isin: instrument.isin ?? undefined,
        name: instrument.name,
        ticker: instrument.ticker,
      }));
    }
    return (await new AlpacaAPI(options).getAssets({asset_class: AlpacaAssetClass.US_EQUITY})).map(asset => ({
      currency: 'USD',
      name: asset.name,
      ticker: asset.symbol,
    }));
  };

  return {broker, listInstruments};
}
