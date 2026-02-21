import {z} from 'zod';

export type Order = z.infer<typeof OrderSchema>;

export const OrderStatus = {
  ACCEPTED: 'accepted',
  ACCEPTED_FOR_BIDDING: 'accepted_for_bidding',
  CALCULATED: 'calculated',
  CANCELED: 'canceled',
  DONE_FOR_DAY: 'done_for_day',
  EXPIRED: 'expired',
  FILLED: 'filled',
  NEW: 'new',
  PARTIALLY_FILLED: 'partially_filled',
  PENDING_CANCEL: 'pending_cancel',
  PENDING_NEW: 'pending_new',
  PENDING_REPLACE: 'pending_replace',
  REJECTED: 'rejected',
  REPLACED: 'replaced',
  STOPPED: 'stopped',
  SUSPENDED: 'suspended',
} as const;

export const OrderSide = {
  BUY: 'buy',
  SELL: 'sell',
} as const;

export const OrderType = {
  LIMIT: 'limit',
  MARKET: 'market',
  STOP: 'stop',
  STOP_LIMIT: 'stop_limit',
  TRAILING_STOP: 'trailing_stop',
} as const;

export const TimeInForce = {
  CLS: 'cls',
  DAY: 'day',
  FOK: 'fok',
  GTC: 'gtc',
  IOC: 'ioc',
  OPG: 'opg',
} as const;

export const AssetClass = {
  CRYPTO: 'crypto',
  US_EQUITY: 'us_equity',
  US_OPTION: 'us_option',
} as const;

export type AssetClassValue = (typeof AssetClass)[keyof typeof AssetClass];

export const OrderSchema = z.looseObject({
  asset_class: z.enum(['crypto', 'us_equity', 'us_option']),
  asset_id: z.string(),
  canceled_at: z.string().nullable(),
  client_order_id: z.string(),
  created_at: z.string(),
  expired_at: z.string().nullable(),
  extended_hours: z.boolean(),
  failed_at: z.string().nullable(),
  filled_at: z.string().nullable(),
  filled_avg_price: z.string().nullable(),
  filled_qty: z.string(),
  id: z.string(),
  legs: z.unknown().nullable(),
  limit_price: z.string().nullable(),
  notional: z.string().nullable(),
  qty: z.string().nullable(),
  replaced_at: z.string().nullable(),
  replaced_by: z.string().nullable(),
  replaces: z.string().nullable(),
  side: z.string(),
  status: z.string(),
  stop_price: z.string().nullable(),
  submitted_at: z.string(),
  symbol: z.string(),
  time_in_force: z.string(),
  type: z.string(),
  updated_at: z.string(),
});
