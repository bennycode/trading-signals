import {z} from 'zod';
import {Trading212OrderStatusSchema, Trading212OrderTypeSchema, Trading212TimeValiditySchema} from './OrderSchema.js';

/**
 * Trading212's `/equity/history/orders` returns each item as a nested
 * `{order: {...}, fill: {...}}` pair. Filled orders carry a `fill` object
 * with the realised price and the FX/duty fee breakdown under `walletImpact`.
 *
 * @see https://t212public-api-docs.redoc.ly/#operation/orders_1
 */

const TaxSchema = z.looseObject({
  chargedAt: z.string().nullish(),
  currency: z.string().nullish(),
  name: z.string().nullish(),
  /** Negative when debited from the account (e.g. CURRENCY_CONVERSION_FEE: -0.57). */
  quantity: z.number().nullish(),
});

const WalletImpactSchema = z.looseObject({
  currency: z.string().nullish(),
  fxRate: z.number().nullish(),
  netValue: z.number().nullish(),
  realisedProfitLoss: z.number().nullish(),
  taxes: z.array(TaxSchema).nullish(),
});

const InstrumentSummarySchema = z.looseObject({
  currency: z.string().nullish(),
  isin: z.string().nullish(),
  name: z.string().nullish(),
  ticker: z.string().nullish(),
});

const HistoryOrderInnerSchema = z.looseObject({
  createdAt: z.string().nullish(),
  /** Account currency (e.g. "EUR"), not the instrument currency. */
  currency: z.string().nullish(),
  extendedHours: z.boolean().nullish(),
  filledQuantity: z.number().nullish(),
  id: z.number().nullish(),
  initiatedFrom: z.string().nullish(),
  instrument: InstrumentSummarySchema.nullish(),
  limitPrice: z.number().nullish(),
  /** Signed: positive = BUY, negative = SELL. */
  quantity: z.number().nullish(),
  side: z.string().nullish(),
  status: Trading212OrderStatusSchema.nullish(),
  stopPrice: z.number().nullish(),
  /** "QUANTITY" or "VALUE". */
  strategy: z.string().nullish(),
  ticker: z.string().nullish(),
  timeValidity: Trading212TimeValiditySchema.nullish(),
  type: Trading212OrderTypeSchema.nullish(),
});

const HistoryFillSchema = z.looseObject({
  filledAt: z.string().nullish(),
  id: z.number().nullish(),
  price: z.number().nullish(),
  /** Signed: positive for BUY fills, negative for SELL fills. */
  quantity: z.number().nullish(),
  tradingMethod: z.string().nullish(),
  type: z.string().nullish(),
  walletImpact: WalletImpactSchema.nullish(),
});

export const HistoryOrderSchema = z.looseObject({
  fill: HistoryFillSchema.nullish(),
  order: HistoryOrderInnerSchema,
});

export const HistoryOrderPageSchema = z.looseObject({
  items: z.array(HistoryOrderSchema),
  nextPagePath: z.string().nullable(),
});

export type HistoryOrder = z.infer<typeof HistoryOrderSchema>;
export type HistoryOrderPage = z.infer<typeof HistoryOrderPageSchema>;
