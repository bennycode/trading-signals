import {getAverage} from './getAverage.js';

/**
 * Standard deviation calculates how prices for a collection of prices are spread out from the average price of these
 * prices. Standard deviation makes outliers even more visible than mean absolute deviation (MAD).
 *
 * @see https://www.mathsisfun.com/data/standard-deviation-formulas.html
 * @see https://www.youtube.com/watch?v=9-8E8L_77-8
 */
export function getStandardDeviation(values: number[], average?: number): number {
  const middle = average || getAverage(values);
  const squaredDifferences = values.map(value => value - middle).map(value => value * value);
  const averageDifference = getAverage(squaredDifferences);
  return Math.sqrt(averageDifference);
}
