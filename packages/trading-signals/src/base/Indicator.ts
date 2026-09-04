import {NotEnoughDataError} from '../error/NotEnoughDataError.js';
import type {
  HighLow,
  HighLowClose,
  HighLowCloseVolume,
  OpenHighLowClose,
  OpenHighLowCloseVolume,
} from './Candle.type.js';
import type {SignalThresholds} from './SignalThresholds.type.js';

type Nullable<Result> = Result | null;

/**
 * The candle fields an indicator consumes. TypeScript's input types are erased at runtime,
 * so generic consumers (CLIs, strategy builders, docs) need this as a value to know which
 * part of a candle to feed into `add()` without hardcoding knowledge per indicator.
 */
export const IndicatorInputShape = {
  HIGH_LOW: 'high-low',
  HIGH_LOW_CLOSE: 'high-low-close',
  HIGH_LOW_CLOSE_VOLUME: 'high-low-close-volume',
  OPEN_HIGH_LOW_CLOSE: 'open-high-low-close',
  OPEN_HIGH_LOW_CLOSE_VOLUME: 'open-high-low-close-volume',
  /** A single price series — the close by convention, but any value series works. */
  VALUE: 'value',
  /** A single volume series. Same runtime type as VALUE, but consumers must feed volumes, not prices. */
  VOLUME: 'volume',
} as const;

export type IndicatorInputShapes = (typeof IndicatorInputShape)[keyof typeof IndicatorInputShape];

/**
 * Maps an indicator's `Input` generic to the correct {@link IndicatorInputShape} literal,
 * so declaring a wrong shape fails to compile. Checked from the widest candle down, because
 * candle types extend each other structurally. Scalar inputs allow VALUE or VOLUME — the
 * type system cannot tell a price series from a volume series, so that distinction is the
 * one part a human declares. Indicators with a custom input (e.g. another indicator's
 * result type) map to `never` — they have no generic candle shape to declare. Generic
 * consumers that hold an indicator with an `unknown` input see the full union.
 */
export type InputShapeOf<Input> = unknown extends Input
  ? IndicatorInputShapes
  : Input extends number
    ? typeof IndicatorInputShape.VALUE | typeof IndicatorInputShape.VOLUME
    : Input extends OpenHighLowCloseVolume<number>
      ? typeof IndicatorInputShape.OPEN_HIGH_LOW_CLOSE_VOLUME
      : Input extends HighLowCloseVolume<number>
        ? typeof IndicatorInputShape.HIGH_LOW_CLOSE_VOLUME
        : Input extends OpenHighLowClose<number>
          ? typeof IndicatorInputShape.OPEN_HIGH_LOW_CLOSE
          : Input extends HighLowClose<number>
            ? typeof IndicatorInputShape.HIGH_LOW_CLOSE
            : Input extends HighLow<number>
              ? typeof IndicatorInputShape.HIGH_LOW
              : never;

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

  /**
   * The candle fields this indicator consumes, as a runtime value. The type ties the
   * declaration to the `Input` generic, so a mismatching shape fails to compile.
   */
  abstract readonly inputShape: InputShapeOf<Input>;

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
 * Counterpart to {@link TrendIndicatorSeries} for indicators whose result is a composite object
 * (multiple bands or lines) instead of a single number. Subclasses inherit previous-result
 * caching and signal-change detection instead of hand-rolling them per indicator.
 */
export abstract class TrendIndicator<
  Result,
  Input = number,
  State extends object = Record<string, never>,
  SignalState = TradingSignals,
> extends TechnicalIndicator<Result, Input, State> {
  protected abstract calculateSignalState(result?: Result | null | undefined): SignalState;
  protected previousResult?: Result;
  #previousSignalState?: SignalState;

  protected setResult(value: Result, replace: boolean) {
    // When replacing, restore the previous signal state
    if (replace && this.previousResult !== undefined) {
      this.#previousSignalState = this.calculateSignalState(this.previousResult);
    } else if (!replace) {
      // Cache the previous signal state before updating
      this.#previousSignalState = this.calculateSignalState(this.result);
    }

    // When replacing the latest value, restore previous result first
    if (replace) {
      this.result = this.previousResult;
    }

    // Cache previous result
    this.previousResult = this.result;

    // Set new result
    return (this.result = value);
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
 * Most oscillators share one reading of the zero line. Above it means bullish pressure, below it
 * bearish. Oscillators that read the zero line differently implement their own signal.
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

/**
 * Threshold oscillators share one reading of their overbought/oversold bands: a reading inside the
 * overbought band means bullish pressure, one inside the oversold band bearish pressure. The
 * reported direction is the pressure itself, not trade advice. Oscillators that read their bands
 * differently implement their own signal.
 */
export abstract class ThresholdCrossSeries<
  Input = number,
  State extends object = Record<string, never>,
> extends TrendIndicatorSeries<Input, TradingSignals, State> {
  readonly #overbought: number;
  readonly #oversold: number;

  constructor({overbought, oversold}: Required<SignalThresholds>) {
    super();

    // Inverted bands would flag bullish pressure below the bearish band; when both bands meet at a single value, the oversold reading wins
    if (!Number.isFinite(overbought) || !Number.isFinite(oversold) || oversold > overbought) {
      throw new Error(
        `The oversold threshold ("${oversold}") has to be at or below the overbought threshold ("${overbought}").`
      );
    }

    this.#overbought = overbought;
    this.#oversold = oversold;
  }

  protected calculateSignalState(result?: number | null | undefined) {
    if (result === null || result === undefined) {
      return TradingSignal.UNKNOWN;
    }

    if (result <= this.#oversold) {
      return TradingSignal.BEARISH;
    }

    if (result >= this.#overbought) {
      return TradingSignal.BULLISH;
    }

    return TradingSignal.SIDEWAYS;
  }
}
