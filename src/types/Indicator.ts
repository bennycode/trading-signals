import {NotEnoughDataError} from '../error/NotEnoughDataError.js';

type Nullable<Result> = Result | null;

interface Indicator<Result = number, Input = number> {
  isStable: boolean;
  add(input: Input): Nullable<Result>;
  getRequiredInputs(): number;
  getResult(): Nullable<Result>;
  getResultOrThrow(): Result;
  replace(input: Input): Nullable<Result>;
  update(input: Input, replace: boolean): Nullable<Result>;
  updates(input: Input[], replace: boolean): Nullable<Result>[];
}

export abstract class TechnicalIndicator<Result, Input> implements Indicator<Result, Input> {
  protected result: Result | undefined;

  abstract getRequiredInputs(): number;

  getResult() {
    try {
      return this.getResultOrThrow();
    } catch {
      return null;
    }
  }

  getResultOrThrow() {
    if (this.result === undefined) {
      throw new NotEnoughDataError(this.getRequiredInputs());
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
    return inputs.map(input => this.update(input, replace));
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

export abstract class IndicatorSeries<Input = number> extends BaseIndicatorSeries<number, Input> {
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
