import {z} from 'zod';

/** @see https://site.financialmodelingprep.com/developer/docs/stable#price-target-summary */
export const FmpPriceTargetSummarySchema = z.looseObject({
  lastMonthAvgPriceTarget: z.number(),
  lastQuarterAvgPriceTarget: z.number(),
  symbol: z.string(),
});

export type FmpPriceTargetSummary = z.infer<typeof FmpPriceTargetSummarySchema>;
