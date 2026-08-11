import {TechnicalIndicator} from '../../base/Indicator.js';
import type {LinearRegressionResult} from '../../util/math/getLinearRegression.js';
import {getLinearRegression} from '../../util/math/getLinearRegression.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

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

    return (this.result = getLinearRegression(this.prices));
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
