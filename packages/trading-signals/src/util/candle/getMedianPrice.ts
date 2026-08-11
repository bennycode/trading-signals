import type {HighLow} from '../../base/Candle.type.js';

/**
 * Collapses a candle into the midpoint of its trading range — the bar's center of gravity without
 * weighting where it settled. Several indicators feed on this midpoint instead of the close
 * (e.g. Alligator, Fisher Transform, Parabolic SAR).
 *
 * @see https://tulipindicators.org/medprice
 */
export function getMedianPrice({high, low}: HighLow<number>) {
  return (high + low) / 2;
}
