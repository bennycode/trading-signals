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

export const PlaceMarketOrderRequestSchema = z.object({
  quantity: z.number(),
  ticker: z.string(),
});

export const PlaceLimitOrderRequestSchema = z.object({
  limitPrice: z.number(),
  quantity: z.number(),
  ticker: z.string(),
  timeValidity: Trading212TimeValiditySchema,
});

export type Order = z.infer<typeof OrderSchema>;
export type PlaceMarketOrderRequest = z.infer<typeof PlaceMarketOrderRequestSchema>;
export type PlaceLimitOrderRequest = z.infer<typeof PlaceLimitOrderRequestSchema>;
