import {z} from 'zod';
import {ExchangeCandleBase} from '../exchange/Exchange.js';

export const BasicCandlePrice = z.union([z.literal('open'), z.literal('high'), z.literal('low'), z.literal('close')]);

export type BasicCandlePriceProperty = z.infer<typeof BasicCandlePrice>;

export const ONE_MINUTE_IN_MS = 60_000;

export interface BatchedCandle extends ExchangeCandleBase {
  // Prices
  close: Big;
  closeAsk: Big;
  high: Big;
  highAsk: Big;
  low: Big;
  lowAsk: Big;
  open: Big;
  openAsk: Big;
  // Metadata
  change: Big;
  medianPrice: Big;
  volume: Big;
  weightedMedianPrice: Big;
  // State
  isNegative: boolean;
  isPositive: boolean;
}

/**
 * A BatchedCandle guaranteed to represent a 1-minute interval.
 * Strategies always receive 1-minute candles. If a strategy needs a larger timeframe,
 * it should aggregate candles internally using CandleBatcher.
 */
export interface OneMinuteBatchedCandle extends BatchedCandle {
  sizeInMillis: typeof ONE_MINUTE_IN_MS;
}
