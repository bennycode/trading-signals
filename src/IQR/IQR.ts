import type {BigSource} from 'big.js';
import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import {getFasterQuartile, getQuartile} from '../util/getQuartile.js';

/**
 * Interquartile Range (IQR)
 * Type: Volatility
 *
 * The IQR is the difference between the 75th percentile (Q3) and the 25th percentile (Q1) of a data set.
 * It is a measure of statistical dispersion and is robust to outliers.
 *
 * @see https://github.com/bennycode/trading-signals/discussions/752
 * @see https://en.wikipedia.org/wiki/Interquartile_range
 */
export class IQR extends BigIndicatorSeries {
  private readonly values: Big[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(value: BigSource, replace: boolean): Big | null {
    const bigValue = new Big(value);

    if (replace) {
      this.values.pop();
    }

    this.values.push(bigValue);

    if (this.values.length > this.interval) {
      this.values.shift();
    }

    if (this.values.length < this.interval) {
      return null;
    }

    const q1 = getQuartile(this.values, 0.25);
    const q3 = getQuartile(this.values, 0.75);

    return this.setResult(q3.minus(q1), replace);
  }
}

export class FasterIQR extends NumberIndicatorSeries {
  private readonly values: number[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(value: number, replace: boolean): number | null {
    if (replace) {
      this.values.pop();
    }

    this.values.push(value);

    if (this.values.length > this.interval) {
      this.values.shift();
    }

    if (this.values.length < this.interval) {
      return null;
    }

    const q1 = getFasterQuartile(this.values, 0.25);
    const q3 = getFasterQuartile(this.values, 0.75);

    return this.setResult(q3 - q1, replace);
  }
}
