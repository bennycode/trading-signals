import {z} from 'zod';

/** One entry from the TipRanks MCP `get_assets_data` tool (headline per-ticker data). */
export const TipRanksAssetSchema = z.looseObject({
  analystConsensus: z.string().nullable(),
  peRatio: z.number().nullable(),
  price: z.number(),
  priceTarget: z.number().nullable(),
  smartScore: z.number().nullable(),
  ticker: z.string(),
});

export type TipRanksAsset = z.infer<typeof TipRanksAssetSchema>;
