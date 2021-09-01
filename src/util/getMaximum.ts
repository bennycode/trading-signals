import {Big, BigSource} from 'big.js';

export function getMaximum(values: BigSource[]): Big {
  let max = new Big(Number.MIN_SAFE_INTEGER);
  for (const value of values) {
    if (max.lt(value)) {
      max = new Big(value);
    }
  }
  return max;
}
