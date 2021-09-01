import {Big, BigSource} from 'big.js';

export function getMinimum(values: BigSource[]): Big {
  let min = new Big(Number.MAX_SAFE_INTEGER);
  for (const value of values) {
    if (min.gt(value)) {
      min = new Big(value);
    }
  }
  return min;
}
