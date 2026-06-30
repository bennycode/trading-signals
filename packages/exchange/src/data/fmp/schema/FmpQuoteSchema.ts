import {z} from 'zod';

/** @see https://site.financialmodelingprep.com/developer/docs/stable#quote */
export const FmpQuoteSchema = z.looseObject({
  price: z.number(),
  priceAvg50: z.number(),
  priceAvg200: z.number(),
  symbol: z.string(),
});

export type FmpQuote = z.infer<typeof FmpQuoteSchema>;
