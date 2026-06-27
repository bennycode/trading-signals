import {z} from 'zod';

/**
 * One entry from the TipRanks MCP `get_technical_analysis` tool. Only the simple 200-day moving
 * average is modelled here; the full payload (oscillators, pivots, other MAs) is ignored.
 */
export const TipRanksTechnicalSchema = z.looseObject({
  movingAveragesAnalysis: z.looseObject({
    simple: z.looseObject({
      mA200: z.looseObject({score: z.number()}),
    }),
  }),
  ticker: z.string(),
});

export type TipRanksTechnical = z.infer<typeof TipRanksTechnicalSchema>;
