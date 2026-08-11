/**
 * Converts a price series into per-bar logarithmic returns. Log returns add up across bars, which
 * makes them the preferred input for statistical work over longer horizons — one shorter than the
 * input, because the first price has nothing to be compared against.
 *
 * @throws If fewer than 2 values are given, or a non-positive value makes the logarithm undefined.
 */
export function getLogReturns(values: number[]) {
  if (values.length < 2) {
    throw new Error(`The log returns have to be taken over at least 2 values, but "${values.length}" was given.`);
  }

  const returns: number[] = [];

  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] <= 0 || values[i] <= 0) {
      throw new Error(`The log returns need positive values, but "${values[i - 1]}" and "${values[i]}" were given.`);
    }

    returns.push(Math.log(values[i] / values[i - 1]));
  }

  return returns;
}
