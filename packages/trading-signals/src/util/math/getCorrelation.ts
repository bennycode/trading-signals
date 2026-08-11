import {getAverage} from './getAverage.js';
import {getStandardDeviation} from './getStandardDeviation.js';

/**
 * Pearson correlation between two series: `1` means they move in lockstep, `-1` in perfect
 * opposition, `0` independently. The workhorse behind pairs trading and diversification checks.
 *
 * @throws If the series differ in length, hold fewer than 2 pairs, or one of them shows no variance.
 */
export function getCorrelation(valuesA: number[], valuesB: number[]) {
  if (valuesA.length !== valuesB.length) {
    throw new Error(
      `The series have to be of equal length, but "${valuesA.length}" and "${valuesB.length}" were given.`
    );
  }

  if (valuesA.length < 2) {
    throw new Error(`The correlation has to be taken over at least 2 pairs, but "${valuesA.length}" was given.`);
  }

  const averageA = getAverage(valuesA);
  const averageB = getAverage(valuesB);

  let covariance = 0;

  for (let i = 0; i < valuesA.length; i++) {
    covariance += (valuesA[i] - averageA) * (valuesB[i] - averageB);
  }

  covariance /= valuesA.length;

  const denominator = getStandardDeviation(valuesA, averageA) * getStandardDeviation(valuesB, averageB);

  if (denominator === 0) {
    throw new Error('Cannot correlate a series without variance.');
  }

  return covariance / denominator;
}
