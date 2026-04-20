/**
 * Default lookback values for swing point detection.
 *
 * - `BILL_WILLIAMS`: 2 candles on each side, as used in Bill Williams' fractal indicator.
 * - `CHARTISTS`: 5 candles on each side, a common choice among discretionary chart readers
 *   for more significant swing highs/lows that filter out minor noise.
 *
 * @see https://www.investopedia.com/terms/f/fractal.asp
 */
export const SwingLookback = {
  BILL_WILLIAMS: 2,
  CHARTISTS: 5,
} as const;
