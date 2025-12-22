import {z} from 'zod';

export const ExchangeCandleBaseSchema = z.object({
  /** ID of base asset */
  base: z.string(),

  /** ID of quote asset */
  counter: z.string(),

  /** True, if this candle is the latest / current candle from the exchange. This flag is good to know if a candle comes from a history import or not. */
  isLatest: z.boolean().optional(),
  /** Bucket start time in simplified extended ISO 8601 format */
  openTimeInISO: z.string(),
  /** Bucket start time converted to milliseconds (note: Coinbase Pro actually uses seconds) */
  openTimeInMillis: z.number(),
  /** Candle size in milliseconds */
  sizeInMillis: z.number(),
});

export type ExchangeCandleBase = z.infer<typeof ExchangeCandleBaseSchema>;

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
