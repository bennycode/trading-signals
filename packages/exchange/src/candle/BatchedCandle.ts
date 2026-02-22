import {z} from 'zod';
import {ExchangeCandleBase} from '../exchange/Exchange.js';

export const BasicCandlePrice = z.union([z.literal('open'), z.literal('high'), z.literal('low'), z.literal('close')]);

export type BasicCandlePriceProperty = z.infer<typeof BasicCandlePrice>;

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
