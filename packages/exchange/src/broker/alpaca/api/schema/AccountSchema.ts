import {z} from 'zod';

export type Account = z.infer<typeof AccountSchema>;

/** @see https://docs.alpaca.markets/reference/getaccount-1 */
export const AccountSchema = z.looseObject({
  account_blocked: z.boolean(),
  account_number: z.string(),
  buying_power: z.string(),
  cash: z.string(),
  created_at: z.string(),
  currency: z.string(),
  daytrade_count: z.number(),
  equity: z.string(),
  id: z.string(),
  initial_margin: z.string(),
  last_equity: z.string(),
  long_market_value: z.string(),
  maintenance_margin: z.string(),
  multiplier: z.string(),
  pattern_day_trader: z.boolean(),
  portfolio_value: z.string(),
  short_market_value: z.string(),
  shorting_enabled: z.boolean(),
  status: z.string(),
  trade_suspended_by_user: z.boolean(),
  trading_blocked: z.boolean(),
  transfers_blocked: z.boolean(),
});
