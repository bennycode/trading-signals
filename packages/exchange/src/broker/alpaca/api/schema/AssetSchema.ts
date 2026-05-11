import {z} from 'zod';

export type Asset = z.infer<typeof AssetSchema>;

/** @see https://docs.alpaca.markets/reference/get-v2-assets */
export const AssetSchema = z.looseObject({
  class: z.string(),
  easy_to_borrow: z.boolean(),
  exchange: z.string(),
  fractionable: z.boolean(),
  id: z.string(),
  maintenance_margin_requirement: z.number().optional(),
  marginable: z.boolean(),
  /** Crypto-specific: minimum order size */
  min_order_size: z.string().optional(),
  /** Crypto-specific: minimum trade increment */
  min_trade_increment: z.string().optional(),
  name: z.string(),
  /** Crypto-specific: price increment */
  price_increment: z.string().optional(),
  shortable: z.boolean(),
  status: z.string(),
  symbol: z.string(),
  tradable: z.boolean(),
});
