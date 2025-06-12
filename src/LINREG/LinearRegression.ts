import type {BigSource} from 'big.js';
import Big from 'big.js';
import {TechnicalIndicator} from '../Indicator.js';
import {pushUpdate} from '../util/pushUpdate.js';
import {NotEnoughDataError} from '../error/index.js';

export type LinearRegressionResult = {
  // The predicted value (equivalent to TulipCharts' linreg)
  prediction: Big;
  // The slope (equivalent to TulipCharts' linregslope)
  slope: Big;
  // The y-intercept (equivalent to TulipCharts' linregintercept)
  intercept: Big;
};

export type FasterLinearRegressionResult = {
  // The predicted value (equivalent to TulipCharts' linreg)
  prediction: number;
  // The slope (equivalent to TulipCharts' linregslope)
  slope: number;
  // The y-intercept (equivalent to TulipCharts' linregintercept)
  intercept: number;
};

export class LinearRegression extends TechnicalIndicator<LinearRegressionResult, BigSource> {
  public readonly prices: BigSource[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override getRequiredInputs() {
    return this.interval;
  }

  private calculateRegression(prices: BigSource[]): LinearRegressionResult {
    const n = new Big(prices.length);
    const xValues = Array.from({length: prices.length}, (_, i) => new Big(i));
    const yValues = prices.map(p => new Big(p));

    // Calculate sums
    const sumX = xValues.reduce((sum, x) => sum.add(x), new Big(0));
    const sumY = yValues.reduce((sum, y) => sum.add(y), new Big(0));
    const sumXY = xValues.reduce((sum, x, i) => sum.add(x.mul(yValues[i])), new Big(0));
    const sumXX = xValues.reduce((sum, x) => sum.add(x.mul(x)), new Big(0));

    // Calculate slope using the least squares formula
    const slope = sumXY
      .mul(n)
      .sub(sumX.mul(sumY))
      .div(sumXX.mul(n).sub(sumX.mul(sumX)));

    // Calculate intercept
    const intercept = sumY.sub(slope.mul(sumX)).div(n);

    // Calculate prediction
    const prediction = slope.mul(xValues[xValues.length - 1]).add(intercept);

    return {
      intercept,
      prediction,
      slope,
    };
  }

  update(price: BigSource, replace: boolean): LinearRegressionResult | null {
    pushUpdate(this.prices, replace, price, this.interval);

    if (this.prices.length < this.interval) {
      return null;
    }

    return (this.result = this.calculateRegression(this.prices));
  }

  override getResultOrThrow(): LinearRegressionResult {
    if (this.prices.length < this.interval) {
      throw new NotEnoughDataError(this.getRequiredInputs());
    }
    return this.result!;
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

export class FasterLinearRegression extends TechnicalIndicator<FasterLinearRegressionResult, number> {
  public readonly prices: number[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override getRequiredInputs() {
    return this.interval;
  }

  private calculateRegression(prices: number[]): FasterLinearRegressionResult {
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

  update(price: number, replace: boolean): FasterLinearRegressionResult | null {
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
