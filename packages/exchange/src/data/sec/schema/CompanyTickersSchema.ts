import {z} from 'zod';

export const CompanyTickersSchema = z.record(
  z.string(),
  z.looseObject({
    cik_str: z.number(),
    ticker: z.string(),
    title: z.string(),
  })
);
