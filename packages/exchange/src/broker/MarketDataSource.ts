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
   *
   * Anchors to the latest real bar (so market closures — nights, weekends, holidays — don't leave
   * us paging an empty "now" window that never fills) and walks backward in widening windows,
   * deduping by open time, until it has `count` bars or history runs out. Built purely on the
   * abstract `getCandles`/`getLatestCandle`, so every data source inherits it without supplying its
   * own backward pagination.
   */
  async getRecentCandles(pair: TradingPair, count: number, intervalInMillis: number): Promise<Candle[]> {
    if (count <= 0) {
      return [];
    }

    const byOpenTime = new Map<number, Candle>();
    const latest = await this.getLatestCandle(pair, intervalInMillis);
    byOpenTime.set(latest.openTimeInMillis, latest);
    let endInMillis = latest.openTimeInMillis;

    /*
     * Backstop against an endlessly under-filling window (e.g. a long market halt). Each page can
     * only add bars older than the previous one, so this bounds, not truncates, normal histories.
     */
    const MAX_PAGES = 50;

    for (let page = 0; page < MAX_PAGES && byOpenTime.size < count; page++) {
      const missing = count - byOpenTime.size;
      // Over-ask (2x) so closed sessions inside the window don't starve a single page.
      const spanInMillis = intervalInMillis * missing * 2;
      const window = await this.getCandles(pair, {
        intervalInMillis,
        startTimeFirstCandle: new Date(endInMillis - spanInMillis).toISOString(),
        startTimeLastCandle: new Date(endInMillis).toISOString(),
      });

      let oldest = endInMillis;
      for (const candle of window) {
        byOpenTime.set(candle.openTimeInMillis, candle);
        if (candle.openTimeInMillis < oldest) {
          oldest = candle.openTimeInMillis;
        }
      }

      if (oldest >= endInMillis) {
        // The window surfaced nothing older than where we already were — no more history exists.
        break;
      }
      endInMillis = oldest;
    }

    return [...byOpenTime.values()].sort((left, right) => left.openTimeInMillis - right.openTimeInMillis).slice(-count);
  }

  abstract watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string>;
  abstract unwatchCandles(topicId: string): void;
  abstract disconnect(): void;
}
