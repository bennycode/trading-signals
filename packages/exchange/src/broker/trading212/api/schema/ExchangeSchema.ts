import {z} from 'zod';

/** @see https://t212public-api-docs.redoc.ly/#operation/exchanges */
export const ExchangeSchema = z.looseObject({
  id: z.number(),
  name: z.string(),
  workingSchedules: z
    .array(
      z.looseObject({
        id: z.number(),
      })
    )
    .nullish(),
});

export type Exchange = z.infer<typeof ExchangeSchema>;
