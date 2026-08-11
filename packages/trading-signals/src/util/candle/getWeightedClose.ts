import type {HighLowClose} from '../../base/Candle.type.js';

/**
 * Collapses a candle into a single price with the close counted twice, leaning the reading toward
 * where the bar actually settled while still respecting the range it travelled.
 *
 * @see https://tulipindicators.org/wcprice
 */
export function getWeightedClose({high, low, close}: HighLowClose<number>) {
  return (high + low + 2 * close) / 4;
}
