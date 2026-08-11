import {TechnicalIndicator} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

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
 */
export const calculateLinearRegression = (values: readonly number[]): LinearRegressionResult => {
  const n = values.length;
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

/**
 * Linear Regression (LINREG)
 * Type: Trend
 *
 * It fits a straight line to price data over a chosen period using the least-squares method. The slope of the line shows the trend direction and strength. It’s similar in use to moving averages but mathematically more precise, since it minimizes the squared distance between price points and the fitted line.
 */
export class LinearRegression extends TechnicalIndicator<LinearRegressionResult, number> {
  public readonly prices: number[] = [];

  public readonly interval: number;

  constructor(interval: number) {
    super();

    // A single point cannot define a line, so a slope would be fabricated.
    if (!Number.isFinite(interval) || interval < 2) {
      throw new Error(`The interval has to be at least 2, but "${interval}" was given.`);
    }

    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean): LinearRegressionResult | null {
    pushUpdate({array: this.prices, item: price, maxLength: this.interval, replace: replace});

    if (this.prices.length < this.interval) {
      return null;
    }

    return (this.result = calculateLinearRegression(this.prices));
  }

  override get isStable() {
    try {
      this.getResultOrThrow();
      return true;
    } catch {
      return false;
    }
  }
}
