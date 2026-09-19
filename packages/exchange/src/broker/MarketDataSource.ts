import {EventEmitter} from 'node:events';
import type {Candle, CandleImportRequest} from './Broker.js';
import type {TradingPair} from './TradingPair.js';

/**
 * A pluggable source of historical and real-time OHLC candle data.
 *
 * Decouples market data from execution: brokers that don't expose candles
 * (e.g. Trading212) accept an optional `MarketDataSource` and delegate to it,
 * so a strategy can pair any data provider (Twelve Data, Polygon, EODHD, …)
 * with any execution venue.
 *
 * Implementations emit candles on the EventEmitter via the topicId returned by
 * `watchCandles()`.
 */
export abstract class MarketDataSource extends EventEmitter {
  abstract getCandles(pair: TradingPair, request: CandleImportRequest): Promise<Candle[]>;
  abstract getLatestCandle(pair: TradingPair, intervalInMillis: number): Promise<Candle>;

  /**
   * Fetch the most recent `count` candles of the given interval, oldest first — so a strategy can
   * say "300 hourly candles" without computing calendar windows itself.
   */
  async getRecentCandles(pair: TradingPair, count: number, intervalInMillis: number): Promise<Candle[]> {
    if (count <= 0) {
      return [];
    }

    const latest = await this.getLatestCandle(pair, intervalInMillis);
    return getCandlesUntil(this, pair, count, intervalInMillis, latest.openTimeInMillis);
  }

  abstract watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string>;
  abstract unwatchCandles(topicId: string): void;
  abstract disconnect(): void;
}

/**
 * Fetch the newest `count` candles of the given interval that open at or before
 * `untilInMillis`, oldest first. The cutoff is any point in time, not necessarily a candle open:
 * {@link MarketDataSource.getRecentCandles} passes the latest candle's open, while a backtest
 * passes the moment its window starts, which can fall anywhere inside a candle.
 */
export async function getCandlesUntil(
  source: Pick<MarketDataSource, 'getCandles'>,
  pair: TradingPair,
  count: number,
  intervalInMillis: number,
  untilInMillis: number
): Promise<Candle[]> {
  if (count <= 0) {
    return [];
  }

  /*
   * `getCandles` takes a time window, not a number of candles, and closures (nights, weekends,
   * holidays) mean a window of `count` intervals holds fewer than `count` candles. So walk
   * backwards one window at a time, keeping what each one returns, until enough have come in.
   * Each window is older than the last, so no candle is fetched twice. Windows grow as they go
   * back: an instrument that is mostly closed, or listed later than expected, is reached in a few
   * requests instead of many. The attempt cap stops the walk for a history shorter than `count`.
   */
  const MAX_ATTEMPTS = 8;
  let collected: Candle[] = [];
  let windowEndInMillis = untilInMillis;
  let spanInMillis = intervalInMillis * count;

  for (let attempt = 0; attempt < MAX_ATTEMPTS && collected.length < count; attempt++) {
    const windowStartInMillis = windowEndInMillis - spanInMillis;
    const candles = await source.getCandles(pair, {
      intervalInMillis,
      startTimeFirstCandle: new Date(windowStartInMillis).toISOString(),
      startTimeLastCandle: new Date(windowEndInMillis).toISOString(),
    });

    // `getCandles` returns oldest-first and every window is older than the previous one.
    collected = candles.concat(collected);
    /*
     * The window includes both ends, so the next one stops a millisecond earlier. Stepping back a
     * whole interval instead would skip a bar whenever the anchor is not aligned to the source
     * bars, e.g. daily bars opening at 05:00 with a backtest starting at 14:30.
     */
    windowEndInMillis = windowStartInMillis - 1;
    spanInMillis *= 2;
  }

  return collected.slice(-count);
}
