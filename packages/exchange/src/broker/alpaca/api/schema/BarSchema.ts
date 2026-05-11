import {z} from 'zod';

export type Bar = z.infer<typeof BarSchema>;

export const BarSchema = z.looseObject({
  /** Close price */
  c: z.number(),
  /** High price */
  h: z.number(),
  /** Low price */
  l: z.number(),
  /** Trade count */
  n: z.number(),
  /** Open price */
  o: z.number(),
  /** Timestamp in RFC 3339 format */
  t: z.string(),
  /** Volume */
  v: z.number(),
  /** Volume weighted average price */
  vw: z.number(),
});

export const BarsResponseSchema = z.looseObject({
  bars: z.record(z.string(), z.array(BarSchema)),
  next_page_token: z.string().nullable(),
});

export const LatestBarsResponseSchema = z.looseObject({
  bars: z.record(z.string(), BarSchema),
});
