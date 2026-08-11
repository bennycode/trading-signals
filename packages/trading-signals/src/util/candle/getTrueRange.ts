import type {HighLowClose} from '../../base/Candle.type.js';

/**
 * Measures how far price truly travelled during a bar: the candle's range, widened by any gap from
 * the previous close when the bar opened outside yesterday's range. Without a previous close (the
 * very first candle), the raw high-low range is the whole story.
 *
 * @see https://tulipindicators.org/tr
 */
export function getTrueRange({high, low}: HighLowClose<number>, previousClose?: number) {
  const highLow = high - low;

  if (previousClose === undefined) {
    return highLow;
  }

  return Math.max(highLow, Math.abs(high - previousClose), Math.abs(low - previousClose));
}
