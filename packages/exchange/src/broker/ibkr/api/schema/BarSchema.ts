import {z} from 'zod';

/** One OHLC bar. `t` is the bar's opening time in epoch milliseconds. */
export const IbkrBarSchema = z.looseObject({
  c: z.number(),
  h: z.number(),
  l: z.number(),
  o: z.number(),
  t: z.number(),
  v: z.number().nullish(),
});

/**
 * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/market-data
 */
export const IbkrHistoryResponseSchema = z.looseObject({
  barLength: z.number().nullish(),
  data: z.array(IbkrBarSchema).nullish(),
  /**
   * Scales the slash-encoded `high`/`low` summary strings, NOT the bars in `data`, which already
   * carry currency amounts. Verified against Ford: a `priceFactor` of 100 accompanies
   * `"high": "1227/…"` for a bar whose `h` is `12.27`.
   */
  priceFactor: z.number().nullish(),
  symbol: z.string().nullish(),
  text: z.string().nullish(),
  /** Bars report volume in lots of this size, so `v` is a share count only once multiplied by it. */
  volumeFactor: z.number().nullish(),
});

export type IbkrBar = z.infer<typeof IbkrBarSchema>;
export type IbkrHistoryResponse = z.infer<typeof IbkrHistoryResponseSchema>;
