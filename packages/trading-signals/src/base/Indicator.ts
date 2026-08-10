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

export const TradingSignal = {
  BEARISH: 'BEARISH',
  BULLISH: 'BULLISH',
  SIDEWAYS: 'SIDEWAYS',
  UNKNOWN: 'UNKNOWN',
} as const;

export type TradingSignals = (typeof TradingSignal)[keyof typeof TradingSignal];

/**
 * Implements common update behaviour among indicators.
 */
export abstract class TechnicalIndicator<
  Result,
  Input,
  State extends object = Record<string, never>,
> implements Indicator<Result, Input> {
  protected result: Result | undefined;
  protected state: State = {} as State;
  #previousState?: State;

  abstract getRequiredInputs(): number;

  protected trackState(replace: boolean) {
    if (replace) {
      if (this.#previousState === undefined) {
        /*
         * A replacement before any input still needs a rollback baseline, so repeated
         * replacements of the first logical input remain replacements.
         */
        this.#previousState = structuredClone(this.state);
      } else {
        this.state = structuredClone(this.#previousState);
      }
    } else {
      this.#previousState = structuredClone(this.state);
    }
  }

  /**
   * Snapshot of the result and the mutable state, so two indicator instances fed the same
   * inputs can be compared.
   */
  getState() {
    return structuredClone({...this.state, result: this.result});
  }

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

  get isStable() {
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
export abstract class IndicatorSeries<
  Input = number,
  State extends object = Record<string, never>,
> extends TechnicalIndicator<number, Input, State> {
  protected previousResult?: number;

  protected setResult(value: number, replace: boolean) {
    // When replacing the latest value, restore previous result first
    if (replace) {
      this.result = this.previousResult;
    }

    // Cache previous result
    this.previousResult = this.result;

    // Set new result
    return (this.result = value);
  }

  /**
   * Restores `result` to the previously committed state. Useful for sparse indicators
   * (e.g. swing-point or breakout detectors) whose `replace()` can invalidate a prior
   * emission without producing a new one — in that case the indicator must unwind its
   * last `setResult()` call rather than silently keep a stale value.
   */
  protected rollbackLastResult(): void {
    this.result = this.previousResult;
  }
}

/**
 * Calculates a signal for an indicator.
 */
export abstract class TrendIndicatorSeries<
  Input = number,
  SignalState = TradingSignals,
  State extends object = Record<string, never>,
> extends IndicatorSeries<Input, State> {
  protected abstract calculateSignalState(result?: number | null | undefined): SignalState;
  #previousSignalState?: SignalState;

  protected override setResult(value: number, replace: boolean) {
    // When replacing, restore the previous signal state
    if (replace && this.previousResult !== undefined) {
      this.#previousSignalState = this.calculateSignalState(this.previousResult);
    } else if (!replace) {
      // Cache the previous signal state before updating
      this.#previousSignalState = this.calculateSignalState(this.result);
    }

    return super.setResult(value, replace);
  }

  getSignal(): {
    state: SignalState;
    hasChanged: boolean;
  } {
    const currentState = this.calculateSignalState(this.getResult());
    const hasChanged = this.#previousSignalState !== undefined && this.#previousSignalState !== currentState;

    return {
      hasChanged,
      state: currentState,
    };
  }
}

/**
 * Many oscillators share the same established interpretation: the side of the zero line the
 * reading sits on tells the direction of current pressure. This base class encodes that
 * interpretation once, so an oscillator only implements its calculation. Indicators with a
 * different zero-line reading (e.g. treating zero itself as directional) implement their own
 * signal instead.
 */
export abstract class ZeroCrossSeries<Input = number> extends TrendIndicatorSeries<Input> {
  protected calculateSignalState(result: number | null | undefined) {
    if (result === null || result === undefined) {
      return TradingSignal.UNKNOWN;
    }

    if (result > 0) {
      return TradingSignal.BULLISH;
    }

    if (result < 0) {
      return TradingSignal.BEARISH;
    }

    return TradingSignal.SIDEWAYS;
  }
}
