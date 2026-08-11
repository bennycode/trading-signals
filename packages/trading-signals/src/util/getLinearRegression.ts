export type LinearRegressionResult = {
  // The one-bar-ahead forecast (equivalent to TulipCharts' tsf)
  prediction: number;
  // The slope (equivalent to TulipCharts' linregslope)
  slope: number;
  // The y-intercept (equivalent to TulipCharts' linregintercept)
  intercept: number;
};

/**
 * Least-squares line through the given values. The fitted line at the newest value is
 * `slope * (values.length - 1) + intercept`; the returned prediction extends it one bar ahead.
 *
 * @throws If fewer than 2 values are given, because a single point cannot define a line.
 */
export const getLinearRegression = (values: readonly number[]): LinearRegressionResult => {
  const n = values.length;

  // A single point cannot define a line, so a slope would be fabricated
  if (n < 2) {
    throw new Error(`The linear regression has to be fitted over at least 2 values, but "${n}" was given.`);
  }

  let sumY = 0;
  let sumXY = 0;

  for (let x = 0; x < n; x++) {
    sumY += values[x];
    sumXY += x * values[x];
  }

  const sumX = ((n - 1) * n) / 2;
  const sumXX = ((n - 1) * n * (2 * n - 1)) / 6;
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const prediction = slope * n + intercept;

  return {
    intercept,
    prediction,
    slope,
  };
};
