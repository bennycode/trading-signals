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

export const ExchangeCandleSchema = z
  .object({
    /** Closing price (last trade) during the candle interval */
    close: z.string(),
    /** Represents the minimum price that a seller was willing to take at the end of the candle */
    closeAsk: z.string().optional(),
    /** Highest price during the candle interval */
    high: z.string(),
    /** Represents the minimum price that a seller was willing to take at the peak of the candle */
    highAsk: z.string().optional(),
    /** Lowest price during the candle interval */
    low: z.string(),
    /** Represents the minimum price that a seller was willing to take at the bottom of the candle */
    lowAsk: z.string().optional(),
    /** Opening price (first trade) during the candle interval */
    open: z.string(),
    /** Represents the minimum price that a seller was willing to take at the beginning of the candle */
    openAsk: z.string().optional(),
    /** Amount of traded base currency during the candle interval */
    volume: z.string(),
  })
  .merge(ExchangeCandleBaseSchema);

export type ExchangeCandle = z.infer<typeof ExchangeCandleSchema>;

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
