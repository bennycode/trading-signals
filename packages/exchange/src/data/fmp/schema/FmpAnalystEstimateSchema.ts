import {z} from 'zod';

/** @see https://site.financialmodelingprep.com/developer/docs/stable#analyst-estimates */
export const FmpAnalystEstimateSchema = z.looseObject({
  date: z.string(),
  epsAvg: z.number(),
  symbol: z.string(),
});

export type FmpAnalystEstimate = z.infer<typeof FmpAnalystEstimateSchema>;
