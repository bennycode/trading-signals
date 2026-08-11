import {getPercentageChange} from '../statistics/getPercentageChange.js';

/**
 * Converts a price series into per-bar simple returns, in percent (`25` means "+25%"). Returns are
 * the raw material of volatility and performance math — one shorter than the input, because the
 * first price has nothing to be compared against.
 *
 * @throws If fewer than 2 values are given, or a value of `0` makes a return undefined.
 */
export function getReturns(values: number[]) {
  if (values.length < 2) {
    throw new Error(`The returns have to be taken over at least 2 values, but "${values.length}" was given.`);
  }

  const returns: number[] = [];

  for (let i = 1; i < values.length; i++) {
    returns.push(getPercentageChange(values[i - 1], values[i]));
  }

  return returns;
}
