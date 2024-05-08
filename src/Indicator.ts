import {NotEnoughDataError} from './error/index.js';
import type {Big, BigSource} from './index.js';

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

  protected setResult(value: Big, replace: boolean): Big {
    // Load cached values when replacing the latest value
    if (replace) {
      this.highest = this.previousHighest;
      this.lowest = this.previousLowest;
      this.result = this.previousResult;
    }

    // Check if there is a new high
    if (this.highest === undefined) {
      this.highest = value;
    } else if (value.gt(this.highest)) {
      this.previousHighest = this.highest;
      this.highest = value;
    } else {
      this.previousHighest = this.highest;
    }

    // Check if there is a new low
    if (this.lowest === undefined) {
      this.lowest = value;
    } else if (value.lt(this.lowest)) {
      this.previousLowest = this.lowest;
      this.lowest = value;
    } else {
      this.previousLowest = this.lowest;
    }

    // Cache previous result
    this.previousResult = this.result;
    // Set new result
    return (this.result = value);
  }

  abstract update(input: Input, replace?: boolean): void | Big;

  replace(input: Input) {
    return this.update(input, true);
  }
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

  protected setResult(value: number, replace: boolean): number {
    // Load cached values when replacing the latest value
    if (replace) {
      this.highest = this.previousHighest;
      this.lowest = this.previousLowest;
      this.result = this.previousResult;
    }

    // Check if there is a new high
    if (this.highest === undefined) {
      this.highest = value;
    } else if (value > this.highest) {
      this.previousHighest = this.highest;
      this.highest = value;
    } else {
      this.previousHighest = this.highest;
    }

    // Check if there is a new low
    if (this.lowest === undefined) {
      this.lowest = value;
    } else if (value < this.lowest) {
      this.previousLowest = this.lowest;
      this.lowest = value;
    } else {
      this.previousLowest = this.lowest;
    }

    // Cache previous result
    this.previousResult = this.result;
    // Set new result
    return (this.result = value);
  }

  abstract update(input: Input, replace?: boolean): void | number;

  replace(input: Input) {
    return this.update(input, true);
  }
}
