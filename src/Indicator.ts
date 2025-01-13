import type {BigSource} from 'big.js';
import {NotEnoughDataError} from './error/NotEnoughDataError.js';
import {getLastFromForEach} from './util/getLastFromForEach.js';

interface Indicator<Result = Big, Input = BigSource> {
  isStable: boolean;
  add(input: Input): Result | null;
  getResult(): Result | null;
  getResultOrThrow(): Result;
  replace(input: Input): Result | null;
  update(input: Input, replace: boolean): Result | null;
  updates(input: Input[], replace: boolean): Result | null;
}

export abstract class TechnicalIndicator<Result, Input> implements Indicator<Result, Input> {
  protected result: Result | undefined;

  getResult() {
    try {
      return this.getResultOrThrow();
    } catch {
      return null;
    }
  }

  getResultOrThrow() {
    if (this.result === undefined) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  get isStable(): boolean {
    return this.result !== undefined;
  }

  add(input: Input) {
    return this.update(input, false);
  }

  replace(input: Input) {
    return this.update(input, true);
  }

  abstract update(input: Input, replace: boolean): Result | null;

  updates(inputs: readonly Input[], replace: boolean = false) {
    return getLastFromForEach(inputs, input => this.update(input, replace));
  }
}

/**
 * Tracks results of an indicator over time and memorizes the highest & lowest result.
 */
export abstract class BaseIndicatorSeries<Result, Input> extends TechnicalIndicator<Result, Input> {
  protected previousHighest?: Result;
  highest?: Result;
  protected previousLowest?: Result;
  lowest?: Result;
  protected previousResult?: Result;
  protected abstract setResult(value: Result, replace: boolean): Result;
}

export abstract class BigIndicatorSeries<Input = BigSource> extends BaseIndicatorSeries<Big, Input> {
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
}

export abstract class NumberIndicatorSeries<Input = number> extends BaseIndicatorSeries<number, Input> {
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
}
