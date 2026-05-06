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
  creationTime: z.string(),
  filledQuantity: z.number(),
  filledValue: z.number(),
  id: z.number(),
  limitPrice: z.number().nullable(),
  quantity: z.number().nullable(),
  status: Trading212OrderStatusSchema,
  stopPrice: z.number().nullable(),
  strategy: Trading212OrderStrategySchema,
  ticker: z.string(),
  type: Trading212OrderTypeSchema,
  value: z.number().nullable(),
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
