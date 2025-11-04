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

export const MomentumSignal = {
  NEUTRAL: 'NEUTRAL',
  OVERBOUGHT: 'OVERBOUGHT',
  OVERSOLD: 'OVERSOLD',
  UNKNOWN: 'UNKNOWN',
} as const;

export interface MomentumIndicator {
  getSignal(): (typeof MomentumSignal)[keyof typeof MomentumSignal];
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
 * Tracks results of an indicator over time.
 */
export abstract class IndicatorSeries<Input = number> extends TechnicalIndicator<number, Input> {
  protected previousResult?: number;

  protected setResult(value: number, replace: boolean): number {
    // When replacing the latest value, restore previous result first
    if (replace) {
      this.result = this.previousResult;
    }

    // Cache previous result
    this.previousResult = this.result;

    // Set new result
    return (this.result = value);
  }
}
