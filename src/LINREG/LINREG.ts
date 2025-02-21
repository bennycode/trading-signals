import type {BigSource} from 'big.js';
import Big from 'big.js';
import {TechnicalIndicator} from '../Indicator.js';
import {pushUpdate} from '../util/pushUpdate.js';
import {NotEnoughDataError} from '../error/index.js';

export type LINREGConfig = {
  period: number;
};

export type LINREGResult = {
  // Core Regression Parameters
  slope: Big;
  intercept: Big;
  rSquared: Big;

  // Statistical Parameters
  standardError: Big;
  meanX: Big;
  meanY: Big;

  // Confidence Intervals
  confidenceInterval: {
    slope: [Big, Big];
    intercept: [Big, Big];
  };
};

export type FasterLINREGResult = {
  slope: number;
  intercept: number;
  rSquared: number;
  standardError: number;
  meanX: number;
  meanY: number;
  confidenceInterval: {
    slope: [number, number];
    intercept: [number, number];
  };
};

export class LINREG extends TechnicalIndicator<LINREGResult, BigSource> {
  public readonly prices: BigSource[] = [];
  private readonly period: number;

  constructor(config: LINREGConfig) {
    super();
    this.period = config.period;
  }

  private calculateRegression(prices: BigSource[]): LINREGResult {
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

    // Calculate means for future use
    const meanX = sumX.div(n);
    const meanY = sumY.div(n);

    // Calculate R-squared
    let ssRes = new Big(0); // Sum of squares of residuals
    let ssTot = new Big(0); // Total sum of squares

    for (let i = 0; i < prices.length; i++) {
      const yHat = slope.mul(xValues[i]).add(intercept);
      const residual = yValues[i].sub(yHat);
      const deviation = yValues[i].sub(meanY);

      ssRes = ssRes.add(residual.mul(residual));
      ssTot = ssTot.add(deviation.mul(deviation));
    }

    const rSquared = new Big(1).sub(ssRes.div(ssTot));

    // Calculate standard error
    const standardError = ssRes.div(n.sub(2)).sqrt();

    // Calculate confidence intervals
    const tValue = new Big(2);
    const slopeError = standardError.div(sumXX.mul(n).sub(sumX.mul(sumX)).sqrt());
    const interceptError = standardError.mul(sumXX.div(n.mul(sumXX).sub(sumX.mul(sumX))).sqrt());

    return {
      confidenceInterval: {
        intercept: [intercept.sub(tValue.mul(interceptError)), intercept.add(tValue.mul(interceptError))],
        slope: [slope.sub(tValue.mul(slopeError)), slope.add(tValue.mul(slopeError))],
      },
      intercept,
      meanX,
      meanY,
      rSquared,
      slope,
      standardError,
    };
  }

  update(price: BigSource, replace: boolean): LINREGResult | null {
    pushUpdate(this.prices, replace, price, this.period);

    if (this.prices.length < this.period) {
      return null;
    }

    return (this.result = this.calculateRegression(this.prices));
  }

  override getResultOrThrow(): LINREGResult {
    if (this.prices.length < this.period) {
      throw new NotEnoughDataError();
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

export class FasterLINREG extends TechnicalIndicator<FasterLINREGResult, number> {
  public readonly prices: number[] = [];
  private readonly period: number;

  constructor(config: LINREGConfig) {
    super();
    this.period = config.period;
  }

  private calculateRegression(prices: number[]): FasterLINREGResult {
    const n = prices.length;
    const xValues = Array.from({length: prices.length}, (_, i) => i);
    const yValues = prices;

    // Calculate sums
    const sumX = xValues.reduce((sum, x) => sum + x, 0);
    const sumY = yValues.reduce((sum, y) => sum + y, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

    // Calculate slope using the least squares formula
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Calculate intercept
    const intercept = (sumY - slope * sumX) / n;

    // Calculate means for future use
    const meanX = sumX / n;
    const meanY = sumY / n;

    // Calculate R-squared
    let ssRes = 0; // Sum of squares of residuals
    let ssTot = 0; // Total sum of squares

    for (let i = 0; i < prices.length; i++) {
      const yHat = slope * xValues[i] + intercept;
      const residual = yValues[i] - yHat;
      const deviation = yValues[i] - meanY;

      ssRes += residual * residual;
      ssTot += deviation * deviation;
    }

    const rSquared = 1 - ssRes / ssTot;

    // Calculate standard error
    const standardError = Math.sqrt(ssRes / (n - 2));

    // Calculate confidence intervals
    const tValue = 2;
    const slopeError = standardError / Math.sqrt(n * sumXX - sumX * sumX);
    const interceptError = standardError * Math.sqrt(sumXX / (n * (n * sumXX - sumX * sumX)));

    return {
      confidenceInterval: {
        intercept: [intercept - tValue * interceptError, intercept + tValue * interceptError],
        slope: [slope - tValue * slopeError, slope + tValue * slopeError],
      },
      intercept,
      meanX,
      meanY,
      rSquared,
      slope,
      standardError,
    };
  }

  update(price: number, replace: boolean): FasterLINREGResult | null {
    pushUpdate(this.prices, replace, price, this.period);

    if (this.prices.length < this.period) {
      return null;
    }

    return (this.result = this.calculateRegression(this.prices));
  }

  override getResultOrThrow(): FasterLINREGResult {
    if (this.prices.length < this.period) {
      throw new NotEnoughDataError();
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
