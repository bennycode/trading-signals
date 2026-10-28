import {z} from 'zod';

/**
 * EODHD returns OHLCV as numbers rather than strings, oldest bar first.
 *
 * `open`, `high`, `low` and `close` are as-traded, `adjusted_close` additionally accounts for
 * dividends, and `volume` is split-adjusted. Because the adjusted close is recomputed whenever a
 * new dividend lands, it changes retroactively and must never be treated as stable.
 *
 * @see https://eodhd.com/financial-apis/api-for-historical-data-and-volumes
 */
export const EodBarSchema = z.looseObject({
  adjusted_close: z.number(),
  close: z.number(),
  /** Calendar day, `YYYY-MM-DD`, with no time of day. */
  date: z.string(),
  high: z.number(),
  low: z.number(),
  open: z.number(),
  volume: z.number(),
});

export const EodBarsSchema = z.array(EodBarSchema);

export type EodBar = z.infer<typeof EodBarSchema>;
