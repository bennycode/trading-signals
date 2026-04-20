import {z} from 'zod';

export type Position = z.infer<typeof PositionSchema>;

/** Position side values returned by Alpaca API */
export const PositionSide = {
  LONG: 'long',
  SHORT: 'short',
} as const;
export type PositionSide = (typeof PositionSide)[keyof typeof PositionSide];

/** @see https://docs.alpaca.markets/reference/getallopenpositions */
export const PositionSchema = z.looseObject({
  asset_class: z.enum(['crypto', 'us_equity', 'us_option']),
  asset_id: z.string(),
  avg_entry_price: z.string(),
  change_today: z.string(),
  cost_basis: z.string(),
  current_price: z.string(),
  lastday_price: z.string(),
  market_value: z.string(),
  qty: z.string(),
  side: z.enum(['long', 'short']),
  symbol: z.string(),
  unrealized_intraday_pl: z.string(),
  unrealized_intraday_plpc: z.string(),
  unrealized_pl: z.string(),
  unrealized_plpc: z.string(),
});
