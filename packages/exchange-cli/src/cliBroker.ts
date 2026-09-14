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
  /** Venue the instrument trades on. */
  exchange?: string;
  /**
   * Whether the instrument trades outside its exchange's hours, on the 24/5 venue each broker runs
   * for that purpose. Alpaca calls this an "overnight_tradable" asset, Trading212 "extendedHours".
   */
  extendedHours?: boolean;
  /**
   * Whether the broker accepts a fractional quantity. Left out when the broker does not say:
   * Trading212's instrument metadata carries no fractional information at all.
   */
  fractionable?: boolean;
  isin?: string;
  name: string;
  ticker: string;
  /**
   * Whether the broker currently accepts orders for it. Left out when the broker does not say:
   * everything Trading212 lists is on offer, so it publishes no such flag.
   */
  tradable?: boolean;
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
      const api = new Trading212API(options);
      /*
       * An instrument names a working schedule rather than a venue, and the schedule belongs to an
       * exchange, so the venue comes from joining the two lists.
       */
      const exchanges = await api.getExchanges();
      const venues = new Map<number, string>();
      for (const exchange of exchanges) {
        for (const schedule of exchange.workingSchedules ?? []) {
          venues.set(schedule.id, exchange.name);
        }
      }
      return (await api.getInstruments()).map(instrument => ({
        currency: instrument.currencyCode,
        exchange: instrument.workingScheduleId === null ? undefined : venues.get(instrument.workingScheduleId ?? -1),
        extendedHours: instrument.extendedHours ?? undefined,
        isin: instrument.isin ?? undefined,
        name: instrument.name,
        ticker: instrument.ticker,
      }));
    }
    return (await new AlpacaAPI(options).getAssets({asset_class: AlpacaAssetClass.US_EQUITY})).map(asset => ({
      currency: 'USD',
      exchange: asset.exchange,
      /*
       * Alpaca reports the same capability as an attribute. "overnight_halted" is its counterpart
       * and never appears together with it, so the one flag answers the question on its own.
       */
      extendedHours: asset.attributes?.includes('overnight_tradable') ?? undefined,
      fractionable: asset.fractionable,
      name: asset.name,
      ticker: asset.symbol,
      tradable: asset.tradable,
    }));
  };

  return {broker, listInstruments};
}
