import {getAverage} from './getAverage.js';
import {getStandardDeviation} from './getStandardDeviation.js';

/**
 * Expresses how many standard deviations a value sits away from the average of its window, making
 * "unusually far from normal" comparable across instruments and timeframes — the core reading of
 * mean-reversion setups. Scores the window's newest value unless another value is given.
 *
 * @throws If the window has no variance, because distance from normal is undefined when nothing is normal.
 */
export function getZScore(values: number[], value: number = values[values.length - 1]) {
  const average = getAverage(values);
  const standardDeviation = getStandardDeviation(values, average);

  if (standardDeviation === 0) {
    throw new Error('Cannot calculate the z-score of a window without variance.');
  }

  return (value - average) / standardDeviation;
}
