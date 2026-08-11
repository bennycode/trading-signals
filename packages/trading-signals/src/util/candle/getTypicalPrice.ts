import type {HighLowClose} from '../../base/Candle.type.js';

/**
 * Collapses a candle into the single price most of its trading happened around. Used wherever an indicator needs a
 * candle's price without discarding where it travelled during the bar, which a close on its own would.
 *
 * @see https://tulipindicators.org/typprice
 */
export function getTypicalPrice({high, low, close}: HighLowClose<number>) {
  return (high + low + close) / 3;
}
