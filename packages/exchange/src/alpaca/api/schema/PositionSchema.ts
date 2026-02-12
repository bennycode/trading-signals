import {z} from 'zod';

export type Position = z.infer<typeof PositionSchema>;

/** @see https://docs.alpaca.markets/reference/getallopenpositions */
export const PositionSchema = z.looseObject({
  asset_class: z.string(),
  asset_id: z.string(),
  avg_entry_price: z.string(),
  change_today: z.string(),
  cost_basis: z.string(),
  current_price: z.string(),
  lastday_price: z.string(),
  market_value: z.string(),
  qty: z.string(),
  side: z.string(),
  symbol: z.string(),
  unrealized_intraday_pl: z.string(),
  unrealized_intraday_plpc: z.string(),
  unrealized_pl: z.string(),
  unrealized_plpc: z.string(),
});
