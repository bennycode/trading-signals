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
  abstract watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string>;
  abstract unwatchCandles(topicId: string): void;
  abstract disconnect(): void;
}
