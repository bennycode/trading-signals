import {z} from 'zod';

export const PositionSchema = z.looseObject({
  averagePrice: z.number(),
  currentPrice: z.number(),
  fxPpl: z.number().nullable(),
  initialFillDate: z.string(),
  maxBuy: z.number().nullable(),
  maxSell: z.number().nullable(),
  pieQuantity: z.number(),
  ppl: z.number(),
  quantity: z.number(),
  /** The vendor ticker, e.g. "AAPL_US_EQ" */
  ticker: z.string(),
});

export type Position = z.infer<typeof PositionSchema>;
