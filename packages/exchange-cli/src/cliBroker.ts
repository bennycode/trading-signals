import {
  AlpacaAPI,
  AlpacaAssetClass,
  IbkrBroker,
  MarketDataSource,
  Trading212API,
  Trading212Broker,
  getBrokerClient,
  type Candle,
} from '@typedtrader/exchange';

export const BROKERS = {
  alpaca: {id: 'Alpaca', pollInterval: 5_000},
  ibkr: {id: IbkrBroker.NAME, pollInterval: IbkrBroker.ORDER_POLL_INTERVAL_MS},
  trading212: {id: 'Trading212', pollInterval: Trading212Broker.ORDER_POLL_INTERVAL_MS},
} as const;

export type BrokerKey = keyof typeof BROKERS;

export interface Instrument {
  /**
   * Left out when the broker does not say: IBKR's contract search reports a listing exchange but
   * no currency, which would otherwise cost one contract lookup per search hit to fill in.
   */
  currency?: string | undefined;
  /** Venue the instrument trades on. */
  exchange?: string | undefined;
  /**
   * Whether the instrument trades outside its exchange's hours, on the 24/5 venue each broker runs
   * for that purpose. Alpaca calls this an "overnight_tradable" asset, Trading212 "extendedHours".
   */
  extendedHours?: boolean | undefined;
  /**
   * Whether the broker accepts a fractional quantity. Left out when the broker does not say:
   * Trading212's instrument metadata carries no fractional information at all.
   */
  fractionable?: boolean | undefined;
  isin?: string | undefined;
  name: string;
  ticker: string;
  /**
   * Whether the broker currently accepts orders for it. Left out when the broker does not say:
   * everything Trading212 lists is on offer, so it publishes no such flag.
   */
  tradable?: boolean | undefined;
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

  protected override async getNewestCandles(): Promise<Candle[]> {
    throw new Error(UnavailableMarketData.REASON);
  }

  async watchCandles(): Promise<string> {
    throw new Error(UnavailableMarketData.REASON);
  }

  unwatchCandles(): void {}
  disconnect(): void {}
}

/**
 * IBKR's pair is named differently because it is a different thing: no API keys exist, so the pair
 * is the username and password its gateway logs in with. Paper is a separate login rather than a
 * separate endpoint, so the PAPER/LIVE pair is read when present and the unprefixed `IBKR_ACCOUNT`
 * is kept as the fallback for a single-environment setup.
 *
 * Missing credentials are allowed here alone: an empty pair still talks to a gateway somebody
 * logged in already, which a vendor API has no equivalent of.
 */
export function readCredentials(key: BrokerKey, live: boolean, env: NodeJS.ProcessEnv) {
  if (key === 'ibkr') {
    const scopedKey = live ? env.IBKR_LIVE_ACCOUNT : env.IBKR_PAPER_ACCOUNT;
    const scopedSecret = live ? env.IBKR_LIVE_PASSWORD : env.IBKR_PAPER_PASSWORD;

    /*
     * The pair falls back whole rather than field by field. IBKR's paper and live logins have
     * different passwords by design, so filling a prefixed username's missing password from the
     * unprefixed one builds a pair that belongs to neither login and fails to authenticate.
     */
    if (scopedKey ?? scopedSecret) {
      return {apiKey: scopedKey ?? '', apiSecret: scopedSecret ?? ''};
    }

    return {apiKey: env.IBKR_ACCOUNT ?? '', apiSecret: env.IBKR_PASSWORD ?? ''};
  }

  const prefix = `${key.toUpperCase()}_${live ? 'LIVE' : 'PAPER'}`;
  const apiKey = env[`${prefix}_API_KEY`];
  const apiSecret = env[`${prefix}_API_SECRET`];
  if (!apiKey || !apiSecret) {
    throw new Error(`Missing ${prefix}_API_KEY and/or ${prefix}_API_SECRET in environment.`);
  }
  return {apiKey, apiSecret};
}

/** Uses the existing PAPER/LIVE credential names; loading env files belongs to the caller. */
export function createCliBroker(key: BrokerKey, live: boolean, env: NodeJS.ProcessEnv) {
  const {apiKey, apiSecret} = readCredentials(key, live, env);

  const options = {apiKey, apiSecret, usePaperTrading: !live};
  const broker = getBrokerClient(
    {apiKey, apiSecret, exchangeId: BROKERS[key].id, isPaper: !live},
    key === 'trading212' ? {marketData: new UnavailableMarketData()} : undefined
  );

  /*
   * Instrument discovery is not part of Broker; adapt the existing REST methods here.
   *
   * The query is IBKR's alone: it searches server-side instead of publishing a list, so it cannot
   * answer without one. Alpaca and Trading212 download their catalogue and leave the filtering to
   * the caller, which is why they ignore it.
   */
  const listInstruments = async (query?: string): Promise<Instrument[]> => {
    if (broker instanceof IbkrBroker) {
      if (!query) {
        throw new Error('IBKR publishes no instrument list to download. Search by ticker or company name instead.');
      }
      /*
       * `broker.api` rather than a fresh client: that one waits for the gateway login, so a search
       * issued while the session is still coming up queues instead of returning 401.
       */
      return (await broker.api.searchContracts(query)).map(contract => ({
        exchange: contract.description ?? undefined,
        name: contract.companyName ?? contract.companyHeader ?? contract.symbol ?? '',
        ticker: contract.symbol ?? '',
      }));
    }
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
