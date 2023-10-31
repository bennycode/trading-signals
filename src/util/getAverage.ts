import {Big, BigSource} from '../index.js';

/**
 * Return the mean / average value.
 */
export function getAverage(values: BigSource[]): Big {
  const sum = values.reduce((prev: Big, current: BigSource) => {
    return prev.add(current);
  }, new Big(0));

  return sum.div(values.length || 1);
}

export function getFasterAverage(values: number[]): number {
  return values.length ? values.reduce((sum: number, x: number) => sum + x, 0) / values.length : 0;
}
