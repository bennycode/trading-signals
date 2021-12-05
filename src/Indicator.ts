import Big, {BigSource} from 'big.js';
import {NotEnoughDataError} from './error';

export interface Indicator<Result = Big, Input = BigSource> {
  getResult(): Result;

  isStable: boolean;

  update(input: Input): void | Result;
}

/**
 * Tracks results of an indicator over time and memorizes the highest & lowest result.
 */
export interface IndicatorSeries<Result = Big, Input = BigSource> extends Indicator<Result, Input> {
  highest?: Result;
  lowest?: Result;
}

export abstract class BigIndicatorSeries<Input = BigSource> implements IndicatorSeries<Big, Input> {
  /** Highest return value over the lifetime (not interval!) of the indicator. */
  highest?: Big;
  /** Lowest return value over the lifetime (not interval!) of the indicator. */
  lowest?: Big;
  protected result?: Big;

  get isStable(): boolean {
    return this.result !== undefined;
  }

  getResult(): Big {
    if (this.result === undefined) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  protected setResult(value: Big): Big {
    if (this.highest === undefined || value.gt(this.highest)) {
      this.highest = value;
    }

    if (this.lowest === undefined || value.lt(this.lowest)) {
      this.lowest = value;
    }

    return (this.result = value);
  }

  abstract update(input: Input): void | Big;
}

export abstract class NumberIndicatorSeries<Input = number> implements IndicatorSeries<number, Input> {
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
    if (this.highest === undefined || value > this.highest) {
      this.highest = value;
    }

    if (this.lowest === undefined || value < this.lowest) {
      this.lowest = value;
    }

    return (this.result = value);
  }

  abstract update(input: Input): void | number;
}
