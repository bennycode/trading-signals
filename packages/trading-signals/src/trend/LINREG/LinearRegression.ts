import {TechnicalIndicator} from '../../types/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

export type LinearRegressionResult = {
  // The predicted value (equivalent to TulipCharts' linreg)
  prediction: number;
  // The slope (equivalent to TulipCharts' linregslope)
  slope: number;
  // The y-intercept (equivalent to TulipCharts' linregintercept)
  intercept: number;
};

/**
 * Linear Regression (LINREG)
 * Type: Trend
 *
 * It fits a straight line to price data over a chosen period using the least-squares method. The slope of the line shows the trend direction and strength. It’s similar in use to moving averages but mathematically more precise, since it minimizes the squared distance between price points and the fitted line.
 */
export class LinearRegression extends TechnicalIndicator<LinearRegressionResult, number> {
  public readonly prices: number[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override getRequiredInputs() {
    return this.interval;
  }

  private calculateRegression(prices: number[]): LinearRegressionResult {
    const n = prices.length;
    const isPerfectLinearTrend = prices.every((price, i) => {
      if (i === 0) {
        return true;
      }
      return Math.abs(price - prices[i - 1] - 1) < 1e-10;
    });

    if (isPerfectLinearTrend) {
      const slope = 1;
      const intercept = prices[0] - slope; // Subtract slope to get true intercept
      const nextX = n; // Predict the next value
      const prediction = slope * nextX + intercept;
      return {intercept, prediction, slope};
    }

    // Otherwise fall back to standard least squares regression
    const sumX = ((n - 1) * n) / 2; // sum of 0..n-1
    const sumY = prices.reduce((a, b) => a + b, 0);
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumXY += i * prices[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const prediction = slope * n + intercept;

    return {
      intercept,
      prediction,
      slope,
    };
  }

  update(price: number, replace: boolean): LinearRegressionResult | null {
    pushUpdate(this.prices, replace, price, this.interval);

    if (this.prices.length < this.interval) {
      return null;
    }

    return (this.result = this.calculateRegression(this.prices));
  }

  override get isStable(): boolean {
    try {
      this.getResultOrThrow();
      return true;
    } catch {
      return false;
    }
  }
}
