import {randomUUID} from 'node:crypto';
import {CreateConfig, MarketDataApi} from '@twelvedata/twelvedata-node';
import type {ExchangeCandleImportRequest} from '../Exchange.js';
import {MarketDataSource} from '../MarketDataSource.js';
import type {TradingPair} from '../TradingPair.js';
import {TwelveDataExchangeMapper} from './TwelveDataExchangeMapper.js';

export interface TwelveDataMarketDataOptions {
  apiKey: string;
  /**
   * Optional MIC code for symbol disambiguation (e.g. `'XETR'` for Xetra). When unset,
   * Twelve Data returns its canonical listing for the symbol.
   */
  micCode?: string;
}

/**
 * Twelve Data implementation of `MarketDataSource`. v1 polls `/time_series` for `watchCandles`;
 * a tick-aggregating WebSocket variant can be layered on top later without changing this surface.
 */
export class TwelveDataMarketData extends MarketDataSource {
  readonly #market: MarketDataApi;
  readonly #micCode: string | undefined;
  readonly #candleWatchers = new Map<string, NodeJS.Timeout>();
  readonly #candleStoppers = new Map<string, () => void>();

  constructor(options: TwelveDataMarketDataOptions) {
    super();
    this.#market = new MarketDataApi(CreateConfig(options.apiKey));
    this.#micCode = options.micCode;
  }

  async getCandles(pair: TradingPair, request: ExchangeCandleImportRequest) {
    const interval = TwelveDataExchangeMapper.millisToInterval(request.intervalInMillis);
    const response = await this.#market.getTimeSeries({
      symbol: pair.base,
      interval,
      micCode: this.#micCode,
      startDate: request.startTimeFirstCandle,
      endDate: request.startTimeLastCandle,
      timezone: 'UTC',
    });
    // Twelve Data returns newest-first; reverse so callers get chronological order.
    return response.values
      .map(item => TwelveDataExchangeMapper.toCandle(item, pair, request.intervalInMillis))
      .reverse();
  }

  async getLatestCandle(pair: TradingPair, intervalInMillis: number) {
    const interval = TwelveDataExchangeMapper.millisToInterval(intervalInMillis);
    const response = await this.#market.getTimeSeries({
      symbol: pair.base,
      interval,
      micCode: this.#micCode,
      outputsize: 1,
      timezone: 'UTC',
    });
    const [latest] = response.values;
    if (!latest) {
      throw new Error(`Twelve Data returned no candles for ${pair.asString('/')}.`);
    }
    const candle = TwelveDataExchangeMapper.toCandle(latest, pair, intervalInMillis);
    candle.isLatest = true;
    return candle;
  }

  /**
   * Polls `getLatestCandle` at the candle interval and emits each new bar (deduped by
   * `openTimeInISO`). Latency therefore equals one poll interval.
   *
   * Uses a self-rescheduling loop instead of `setInterval` so a slow tick (network
   * stall, rate-limit retry) cannot overlap with the next request.
   */
  async watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string) {
    const topicId = randomUUID();
    let lastEmittedOpenISO = openTimeInISO;
    let stopped = false;

    const tick = async () => {
      try {
        const candle = await this.getLatestCandle(pair, intervalInMillis);
        if (candle.openTimeInISO > lastEmittedOpenISO) {
          lastEmittedOpenISO = candle.openTimeInISO;
          this.emit(topicId, candle);
        }
      } catch (error) {
        this.emit('error', error);
      } finally {
        if (!stopped) {
          const handle = setTimeout(tick, intervalInMillis);
          this.#candleWatchers.set(topicId, handle);
        }
      }
    };

    this.#candleWatchers.set(topicId, setTimeout(tick, intervalInMillis));
    // Capture the stop flag so unwatchCandles can break the chain.
    this.#candleStoppers.set(topicId, () => {
      stopped = true;
    });
    return topicId;
  }

  unwatchCandles(topicId: string) {
    this.#candleStoppers.get(topicId)?.();
    this.#candleStoppers.delete(topicId);
    const handle = this.#candleWatchers.get(topicId);
    if (handle) {
      clearTimeout(handle);
      this.#candleWatchers.delete(topicId);
    }
    this.removeAllListeners(topicId);
  }

  disconnect() {
    for (const stop of this.#candleStoppers.values()) {
      stop();
    }
    this.#candleStoppers.clear();
    for (const handle of this.#candleWatchers.values()) {
      clearTimeout(handle);
    }
    this.#candleWatchers.clear();
  }
}
