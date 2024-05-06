import type {Big, BigSource} from './index.js';
import {NotEnoughDataError} from './error/index.js';

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
  protected previousHighest?: Big;
  highest?: Big;
  /** Lowest return value over the lifetime (not interval!) of the indicator. */
  protected previousLowest?: Big;
  lowest?: Big;
  /** Previous results can be useful, if a user wants to update a recent value instead of adding a new value. Essential for real-time data like growing candlesticks. */
  protected previousResult?: Big;
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

  protected setResult(value: Big, replace: boolean = false): Big {
    if (replace && this.previousHighest) {
      this.highest = value.gt(this.previousHighest) ? value : this.previousHighest;
    } else if (this.highest === undefined || value.gt(this.highest)) {
      this.previousHighest = this.highest;
      this.highest = value;
    }

    if (replace && this.previousLowest) {
      this.lowest = value.lt(this.previousLowest) ? value : this.previousLowest;
    } else if (this.lowest === undefined || value.lt(this.lowest)) {
      this.previousLowest = this.lowest;
      this.lowest = value;
    }

    this.previousResult = this.result;

    return (this.result = value);
  }

  abstract update(input: Input): void | Big;
}

export abstract class NumberIndicatorSeries<Input = number> implements IndicatorSeries<number, Input> {
  /** Highest return value over the lifetime (not interval!) of the indicator. */
  protected previousHighest?: number;
  highest?: number;
  /** Lowest return value over the lifetime (not interval!) of the indicator. */
  protected previousLowest?: number;
  lowest?: number;
  protected previousResult?: number;
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

  protected setResult(value: number, replace: boolean = false): number {
    if (replace && this.previousHighest !== undefined) {
      this.highest = value > this.previousHighest ? value : this.previousHighest;
    } else if (this.highest === undefined || value > this.highest) {
      this.previousHighest = this.highest;
      this.highest = value;
    }

    if (replace && this.previousLowest) {
      this.lowest = value < this.previousLowest ? value : this.previousLowest;
    } else if (this.lowest === undefined || value < this.lowest) {
      this.previousLowest = this.lowest;
      this.lowest = value;
    }

    this.previousResult = this.result;
    return (this.result = value);
  }

  abstract update(input: Input): void | number;
}
