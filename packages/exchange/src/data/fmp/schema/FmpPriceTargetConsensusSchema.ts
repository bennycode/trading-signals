import {z} from 'zod';

/** @see https://site.financialmodelingprep.com/developer/docs/stable#price-target-consensus */
export const FmpPriceTargetConsensusSchema = z.looseObject({
  symbol: z.string(),
  targetConsensus: z.number(),
  targetHigh: z.number(),
  targetLow: z.number(),
  targetMedian: z.number(),
});

export type FmpPriceTargetConsensus = z.infer<typeof FmpPriceTargetConsensusSchema>;
