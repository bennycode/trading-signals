import {EventEmitter} from 'node:events';
import type {Candle, CandleImportRequest} from './Broker.js';
import type {TradingPair} from './TradingPair.js';

/**
 * The candle surface a caller consumes, independent of who serves it.
 *
 * A broker that owns no data of its own satisfies this by delegating to a {@link MarketDataSource},
 * which is why it is an interface rather than the class: an adapter forwards the public calls
 * without inheriting the fetching internals, and `implements MarketDataSource` would drag those
 * protected members into the adapter's contract.
 */
export interface CandleFeed {
  disconnect(): void;
  getCandles(pair: TradingPair, request: CandleImportRequest): Promise<Candle[]>;
  getLatestCandle(pair: TradingPair, intervalInMillis: number): Promise<Candle>;
  getRecentCandles(pair: TradingPair, count: number, intervalInMillis: number): Promise<Candle[]>;
  unwatchCandles(topicId: string): void;
  watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string>;
}

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
export abstract class MarketDataSource extends EventEmitter implements CandleFeed {
  abstract getCandles(pair: TradingPair, request: CandleImportRequest): Promise<Candle[]>;

  /**
   * The newest bar the source holds, forming or not, used only to anchor a history walk.
   *
   * Protected because a half-built bar is not something a caller should receive: every public
   * accessor here returns closed candles. The anchor comes from the data rather than the clock
   * because bar opens need not sit on the interval grid — IBKR stamps a daily bar at the session
   * open — and because starting at the newest real bar reaches a stale instrument in one request
   * instead of widening the window until it finds one.
   */
  protected abstract getNewestCandle(pair: TradingPair, intervalInMillis: number): Promise<Candle>;

  /**
   * Whether a bar is still being built, and so must be withheld from a caller.
   *
   * Overridable because `open + interval <= now` is right only for a grid-aligned bar. A source
   * that stamps a bar with its session open needs its own test.
   */
  protected isForming(candle: Candle, intervalInMillis: number, nowInMillis: number): boolean {
    return candle.openTimeInMillis + intervalInMillis > nowInMillis;
  }

  /**
   * Fetch the most recent `count` finished candles of the given interval, oldest first — so a
   * strategy can say "300 hourly candles" without computing calendar windows itself. The bar that
   * is still forming is left out, the same as in a backtest.
   */
  async getRecentCandles(pair: TradingPair, count: number, intervalInMillis: number): Promise<Candle[]> {
    if (count <= 0) {
      return [];
    }

    const newest = await this.getNewestCandle(pair, intervalInMillis);
    const untilInMillis = this.isForming(newest, intervalInMillis, Date.now())
      ? newest.openTimeInMillis - 1
      : newest.openTimeInMillis;
    return getCandlesUntil(this, pair, count, intervalInMillis, untilInMillis);
  }

  /**
   * The newest *closed* candle, i.e. `getRecentCandles(pair, 1, interval)` as a single value.
   *
   * Deliberately the same contract as {@link getRecentCandles} rather than "whatever bar is newest":
   * one rule for the whole interface means a price shown to a user, a price used to size an order
   * and a price fed to an indicator all refer to the same bar. The cost is staleness of up to one
   * interval, which is why callers wanting a live price should ask for the smallest interval.
   */
  async getLatestCandle(pair: TradingPair, intervalInMillis: number): Promise<Candle> {
    const [candle] = await this.getRecentCandles(pair, 1, intervalInMillis);

    if (!candle) {
      throw new Error(`No closed ${intervalInMillis} ms candle is available for ${pair.asString('/')}.`);
    }

    return candle;
  }

  abstract watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string>;
  abstract unwatchCandles(topicId: string): void;
  abstract disconnect(): void;
}

/**
 * Fetch the newest `count` candles of the given interval that open at or before `untilInMillis`,
 * oldest first. The cutoff is any point in time, not necessarily a candle open, and each caller
 * decides which moment it stands for.
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
