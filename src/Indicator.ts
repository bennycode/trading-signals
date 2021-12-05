import Big, {BigSource} from 'big.js';
import {NotEnoughDataError} from './error';

export interface Indicator<Output = Big, Input = BigSource> {
  getResult(): Output;

  isStable: boolean;

  update(input: Input): void | Output;
}

/**
 * Tracks results of an indicator over time and memorizes the highest & lowest result.
 */
export interface IndicatorSeries<Output = Big> extends Indicator<Output> {
  highest?: Output;
  lowest?: Output;
}

export abstract class BigIndicatorSeries implements IndicatorSeries {
  /** Highest return value over the lifetime (not interval!) of the indicator. */
  highest?: Big;
  /** Lowest return value over the lifetime (not interval!) of the indicator. */
  lowest?: Big;
  protected result?: Big;

  get isStable(): boolean {
    return this.result !== undefined;
  }

  getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  protected setResult(value: Big): Big {
    if (!this.highest || value.gt(this.highest)) {
      this.highest = value;
    }

    if (!this.lowest || value.lt(this.lowest)) {
      this.lowest = value;
    }

    return (this.result = value);
  }

  abstract update(...args: any): void | Big;
}

export abstract class NumberIndicatorSeries implements IndicatorSeries<number> {
  /** Highest return value over the lifetime (not interval!) of the indicator. */
  highest?: number;
  /** Lowest return value over the lifetime (not interval!) of the indicator. */
  lowest?: number;
  protected result?: number;

  get isStable(): boolean {
    return this.result !== undefined;
  }

  getResult(): number {
    if (this.result === undefined) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  protected setResult(value: number): number {
    if (!this.highest || value > this.highest) {
      this.highest = value;
    }

    if (!this.lowest || value < this.lowest) {
      this.lowest = value;
    }

    return (this.result = value);
  }

  abstract update(...args: any): void | number;
}
