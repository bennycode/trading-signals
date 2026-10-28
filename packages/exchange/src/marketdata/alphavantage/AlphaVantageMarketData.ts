import {ms} from 'ms';
import type {Candle, CandleImportRequest} from '../../broker/Broker.js';
import {MarketDataSource} from '../../broker/MarketDataSource.js';
import type {TradingPair} from '../../broker/TradingPair.js';
import {
  AlphaVantageAPI,
  AlphaVantageFunction,
  type AlphaVantageOutputSize,
  type AlphaVantageAPIOptions,
} from './api/AlphaVantageAPI.js';
import {AlphaVantageMapper} from './AlphaVantageMapper.js';

export interface AlphaVantageMarketDataOptions extends AlphaVantageAPIOptions {
  /** `full` needs a premium key. Left out, the 100 most recent bars come back. */
  outputSize?: AlphaVantageOutputSize;
}

/**
 * Alpha Vantage as a historical candle source, which covers the venues Alpaca does not: a Xetra
 * listing carries a `.DEX` suffix on the symbol, so `new TradingPair('ALV.DEX', 'EUR')` reaches
 * Allianz. Pair the instance with any broker that needs prices it cannot serve itself, which is
 * what {@link https://www.trading212.com Trading212} requires.
 *
 * Only daily and weekly bars are available. Alpha Vantage does serve intraday series, but it
 * timestamps them in the exchange's local timezone instead of UTC, and converting those correctly
 * needs zone data this class does not carry.
 *
 * @see https://www.alphavantage.co/documentation/
 */
export class AlphaVantageMarketData extends MarketDataSource {
  readonly #api: AlphaVantageAPI;
  readonly #outputSize: AlphaVantageOutputSize | undefined;
  /*
   * The free plan allows 25 requests a day, while `getRecentCandles` walks backwards over widening
   * windows and asks for the same series each time. Each distinct series is therefore fetched once
   * per instance and filtered in memory afterwards.
   */
  readonly #series = new Map<string, Promise<Candle[]>>();

  constructor(options: AlphaVantageMarketDataOptions) {
    super();
    this.#api = new AlphaVantageAPI(options);
    this.#outputSize = options.outputSize;
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
      throw new Error(`Alpha Vantage returned no candles for "${pair.base}".`);
    }
    return latest;
  }

  /**
   * Alpha Vantage publishes no candle stream, so a caller that needs live bars has to poll
   * `getLatestCandle` instead.
   */
  watchCandles(): Promise<string> {
    return Promise.reject(
      new Error('Alpha Vantage has no candle stream. Poll "getLatestCandle" for live prices instead.')
    );
  }

  unwatchCandles(): void {
    // Nothing is subscribed because `watchCandles` always rejects.
  }

  disconnect(): void {
    this.#series.clear();
  }

  async #getSeries(pair: TradingPair, intervalInMillis: number): Promise<Candle[]> {
    const seriesFunction = AlphaVantageMarketData.toFunction(intervalInMillis);
    const cacheKey = `${pair.base}|${pair.counter}|${seriesFunction}`;

    let candles = this.#series.get(cacheKey);
    if (candles === undefined) {
      candles = this.#api
        .getTimeSeries({function: seriesFunction, outputsize: this.#outputSize, symbol: pair.base})
        .then(series => AlphaVantageMapper.toCandles(series, pair, intervalInMillis))
        // A failed fetch must not be cached, or the instance can never recover from a rate limit.
        .catch((error: unknown) => {
          this.#series.delete(cacheKey);
          throw error;
        });
      this.#series.set(cacheKey, candles);
    }

    return candles;
  }

  static toFunction(intervalInMillis: number): AlphaVantageFunction {
    if (intervalInMillis === ms('1d')) {
      return AlphaVantageFunction.DAILY;
    }

    if (intervalInMillis === ms('7d')) {
      return AlphaVantageFunction.WEEKLY;
    }

    throw new Error(
      `Alpha Vantage serves daily (${ms('1d')} ms) and weekly (${ms('7d')} ms) candles here, not "${intervalInMillis}" ms.`
    );
  }
}
