import {z} from 'zod';

export const Trading212OrderStatusSchema = z.enum([
  'CANCELLED',
  'CANCELLING',
  'CONFIRMED',
  'FILLED',
  'LOCAL',
  'NEW',
  'PARTIALLY_FILLED',
  'REJECTED',
  'REPLACED',
  'REPLACING',
  'UNCONFIRMED',
]);

export const Trading212OrderTypeSchema = z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']);

export const Trading212OrderStrategySchema = z.enum(['QUANTITY', 'VALUE']);

export const Trading212TimeValiditySchema = z.enum(['DAY', 'GTC']);

export const Trading212OrderStatus = {
  CANCELLED: 'CANCELLED',
  CANCELLING: 'CANCELLING',
  CONFIRMED: 'CONFIRMED',
  FILLED: 'FILLED',
  LOCAL: 'LOCAL',
  NEW: 'NEW',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  REJECTED: 'REJECTED',
  REPLACED: 'REPLACED',
  REPLACING: 'REPLACING',
  UNCONFIRMED: 'UNCONFIRMED',
} as const;

export const Trading212TimeValidity = {
  DAY: 'DAY',
  GTC: 'GTC',
} as const;

export const OrderSchema = z.looseObject({
  creationTime: z.string().nullish(),
  filledQuantity: z.number().nullish(),
  filledValue: z.number().nullish(),
  id: z.number(),
  limitPrice: z.number().nullish(),
  quantity: z.number().nullish(),
  status: Trading212OrderStatusSchema,
  stopPrice: z.number().nullish(),
  strategy: Trading212OrderStrategySchema,
  ticker: z.string(),
  type: Trading212OrderTypeSchema,
  value: z.number().nullish(),
});

/*
 * No `currency` on either request below, though a historical order carries one and selecting the
 * asset's currency is what avoids the 0.15% FX fee ("Pay no FX fees by trading in the asset's
 * currency"). Both endpoints answer `"Invalid payload"` when it is sent, against a control payload
 * that validates — so wallet selection stays an in-app feature, and an order placed through the API
 * settles from the account's primary currency and converts. The one USD-settled fill observed on a
 * EUR account came from `initiatedFrom: "IOS"`, not the API.
 */
export const PlaceMarketOrderRequestSchema = z.object({
  /** Route to Trading212's 24/5 overnight venue (true) or regular session only (default). */
  extendedHours: z.boolean().optional(),
  quantity: z.number(),
  ticker: z.string(),
});

export const PlaceLimitOrderRequestSchema = z.object({
  /*
   * No `extendedHours` here on purpose: the limit endpoint answers "Invalid payload" when it is
   * sent, while the market endpoint accepts it. Leaving it out of the type keeps it from coming
   * back.
   */
  limitPrice: z.number(),
  quantity: z.number(),
  ticker: z.string(),
  timeValidity: Trading212TimeValiditySchema,
});

export type Order = z.infer<typeof OrderSchema>;
export type PlaceMarketOrderRequest = z.infer<typeof PlaceMarketOrderRequestSchema>;
export type PlaceLimitOrderRequest = z.infer<typeof PlaceLimitOrderRequestSchema>;
