import {z} from 'zod';
import {Trading212OrderStatusSchema, Trading212OrderTypeSchema, Trading212TimeValiditySchema} from './OrderSchema.js';

const TaxSchema = z.looseObject({
  fillId: z.string(),
  name: z.string(),
  quantity: z.number(),
  timeCharged: z.string(),
});

export const HistoryOrderSchema = z.looseObject({
  dateCreated: z.string(),
  dateExecuted: z.string().nullable(),
  dateModified: z.string(),
  fillCost: z.number().nullable(),
  fillId: z.number().nullable(),
  fillPrice: z.number().nullable(),
  fillResult: z.number().nullable(),
  fillType: z.string().nullable(),
  filledQuantity: z.number().nullable(),
  filledValue: z.number().nullable(),
  id: z.number(),
  limitPrice: z.number().nullable(),
  orderedQuantity: z.number().nullable(),
  orderedValue: z.number().nullable(),
  parentOrder: z.number(),
  status: Trading212OrderStatusSchema,
  stopPrice: z.number().nullable(),
  taxes: z.array(TaxSchema),
  ticker: z.string(),
  timeValidity: Trading212TimeValiditySchema.nullable(),
  type: Trading212OrderTypeSchema,
});

export const HistoryOrderPageSchema = z.looseObject({
  items: z.array(HistoryOrderSchema),
  nextPagePath: z.string().nullable(),
});

export type HistoryOrder = z.infer<typeof HistoryOrderSchema>;
export type HistoryOrderPage = z.infer<typeof HistoryOrderPageSchema>;
