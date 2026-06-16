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
    const endInMillis = latest.openTimeInMillis;

    /*
     * Start at a 2x over-ask and keep doubling the look-back when closures leave us short. The
     * attempt cap is a backstop against an instrument whose history is simply shorter than `count`;
     * each doubling reaches back exponentially, so a handful of attempts covers years of bars.
     */
    const MAX_ATTEMPTS = 8;
    let spanInMillis = intervalInMillis * count * 2;

    let candles: Candle[] = [];
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      candles = await this.getCandles(pair, {
        intervalInMillis,
        startTimeFirstCandle: new Date(endInMillis - spanInMillis).toISOString(),
        startTimeLastCandle: new Date(endInMillis).toISOString(),
      });

      if (candles.length >= count) {
        break;
      }
      spanInMillis *= 2;
    }

    // `getCandles` returns oldest-first, so the most recent `count` are the tail.
    return candles.slice(-count);
  }

  abstract watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string>;
  abstract unwatchCandles(topicId: string): void;
  abstract disconnect(): void;
}
