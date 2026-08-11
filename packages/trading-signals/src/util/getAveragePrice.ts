import type {OpenHighLowClose} from '../base/Candle.type.js';

/**
 * Collapses a candle into the plain average of its four marks, treating where the bar opened as
 * seriously as where it closed. The most symmetric of the candle price transforms.
 *
 * @see https://tulipindicators.org/avgprice
 */
export function getAveragePrice({open, high, low, close}: OpenHighLowClose<number>) {
  return (open + high + low + close) / 4;
}
