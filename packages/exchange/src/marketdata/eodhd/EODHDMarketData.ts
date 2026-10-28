import {ms} from 'ms';
import type {Candle, CandleImportRequest} from '../../broker/Broker.js';
import {MarketDataSource} from '../../broker/MarketDataSource.js';
import type {TradingPair} from '../../broker/TradingPair.js';
import {EODHDAPI, EODHDPeriod, type EODHDAPIOptions} from './api/EODHDAPI.js';
import {EODHDMapper} from './EODHDMapper.js';

export interface EODHDMarketDataOptions extends EODHDAPIOptions {
  /**
   * Earliest calendar day to request, `YYYY-MM-DD`. Left out, the instrument's whole history is
   * fetched, which is one request however long that history is.
   */
  historyFrom?: string;
}

/**
 * EODHD as a historical candle source, covering the venues Alpaca does not: a Xetra listing is
 * suffixed `.XETRA`, so `new TradingPair('ALV.XETRA', 'EUR')` reaches Allianz, and unlike the other
 * providers this package can reach, Xetra is included at no cost.
 *
 * Daily, weekly and monthly bars. EODHD serves intraday too, but from a separate endpoint that
 * answers 403 without a paid plan, so it is deliberately out of scope here.
 *
 * @see https://eodhd.com/financial-apis/api-for-historical-data-and-volumes
 */
export class EODHDMarketData extends MarketDataSource {
  readonly #api: EODHDAPI;
  readonly #historyFrom: string | undefined;
  /*
   * The free plan allows 20 requests a day, and `getRecentCandles` asks for the same instrument
   * over several widening windows. Fetching one instrument once and slicing it in memory therefore
   * costs a single request where per-window fetching costs one each. It trades response size for
   * request count, which is the scarce one here; `historyFrom` trims the payload when that matters.
   */
  readonly #series = new Map<string, Promise<Candle[]>>();

  constructor(options: EODHDMarketDataOptions) {
    super();
    this.#api = new EODHDAPI(options);
    this.#historyFrom = options.historyFrom;
  }

  async getCandles(pair: TradingPair, request: CandleImportRequest): Promise<Candle[]> {
    const candles = await this.#getSeries(pair, request.intervalInMillis);
    const fromInMillis = new Date(request.startTimeFirstCandle).getTime();
    const untilInMillis = new Date(request.startTimeLastCandle).getTime();

    return candles.filter(
      candle => candle.openTimeInMillis >= fromInMillis && candle.openTimeInMillis <= untilInMillis
    );
  }

  async getLatestCandle(pair: TradingPair, intervalInMillis: number): Promise<Candle> {
    const candles = await this.#getSeries(pair, intervalInMillis);
    const latest = candles.at(-1);
    if (latest === undefined) {
      throw new Error(
        `EODHD returned no candles for "${pair.base}". A renamed ticker answers with an empty series rather than an error, so check the symbol still exists.`
      );
    }
    return latest;
  }

  /**
   * EODHD streams live trades over a WebSocket on its paid plans, but not finished candles, so
   * there is nothing to subscribe to here. Poll `getLatestCandle` instead.
   */
  watchCandles(): Promise<string> {
    return Promise.reject(
      new Error('EODHD publishes no candle stream. Poll "getLatestCandle" for live prices instead.')
    );
  }

  unwatchCandles(): void {
    // Nothing is subscribed because `watchCandles` always rejects.
  }

  disconnect(): void {
    this.#series.clear();
  }

  async #getSeries(pair: TradingPair, intervalInMillis: number): Promise<Candle[]> {
    const period = EODHDMarketData.toPeriod(intervalInMillis);
    const cacheKey = `${pair.base}|${pair.counter}|${period}`;

    let candles = this.#series.get(cacheKey);
    if (candles === undefined) {
      candles = this.#api
        .getEod({from: this.#historyFrom, period, symbol: pair.base})
        .then(bars => EODHDMapper.toCandles(bars, pair, intervalInMillis))
        // A failed fetch must not be cached, or the instance can never recover from a rate limit.
        .catch((error: unknown) => {
          this.#series.delete(cacheKey);
          throw error;
        });
      this.#series.set(cacheKey, candles);
    }

    return candles;
  }

  static toPeriod(intervalInMillis: number): EODHDPeriod {
    if (intervalInMillis === ms('1d')) {
      return EODHDPeriod.DAILY;
    }

    if (intervalInMillis === ms('7d')) {
      return EODHDPeriod.WEEKLY;
    }

    throw new Error(
      `EODHD serves daily (${ms('1d')} ms) and weekly (${ms('7d')} ms) candles here, not "${intervalInMillis}" ms. Monthly bars exist but no fixed number of milliseconds describes a month.`
    );
  }
}
