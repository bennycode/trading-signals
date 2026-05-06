import {z} from 'zod';
import {Trading212OrderStatusSchema, Trading212OrderTypeSchema, Trading212TimeValiditySchema} from './OrderSchema.js';

const TaxSchema = z.looseObject({
  fillId: z.string().nullish(),
  name: z.string().nullish(),
  quantity: z.number().nullish(),
  timeCharged: z.string().nullish(),
});

export const HistoryOrderSchema = z.looseObject({
  dateCreated: z.string().nullish(),
  dateExecuted: z.string().nullish(),
  dateModified: z.string().nullish(),
  fillCost: z.number().nullish(),
  fillId: z.number().nullish(),
  fillPrice: z.number().nullish(),
  fillResult: z.number().nullish(),
  fillType: z.string().nullish(),
  filledQuantity: z.number().nullish(),
  filledValue: z.number().nullish(),
  id: z.number().nullish(),
  limitPrice: z.number().nullish(),
  orderedQuantity: z.number().nullish(),
  orderedValue: z.number().nullish(),
  parentOrder: z.number().nullish(),
  status: Trading212OrderStatusSchema.nullish(),
  stopPrice: z.number().nullish(),
  taxes: z.array(TaxSchema).nullish(),
  ticker: z.string().nullish(),
  timeValidity: Trading212TimeValiditySchema.nullish(),
  type: Trading212OrderTypeSchema.nullish(),
});

export const HistoryOrderPageSchema = z.looseObject({
  items: z.array(HistoryOrderSchema),
  nextPagePath: z.string().nullable(),
});

export type HistoryOrder = z.infer<typeof HistoryOrderSchema>;
export type HistoryOrderPage = z.infer<typeof HistoryOrderPageSchema>;
