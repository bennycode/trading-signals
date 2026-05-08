import {z} from 'zod';

export const AccountCashSchema = z.looseObject({
  blocked: z.number().nullable(),
  free: z.number(),
  invested: z.number(),
  pieCash: z.number(),
  ppl: z.number(),
  result: z.number(),
  total: z.number(),
});

export const AccountInfoSchema = z.looseObject({
  currencyCode: z.string(),
  id: z.number(),
});

export type AccountCash = z.infer<typeof AccountCashSchema>;
export type AccountInfo = z.infer<typeof AccountInfoSchema>;
