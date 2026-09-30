import {IndicatorInputShape, type InputShapeOf, ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {getZScore, pushUpdate} from '../../util/index.js';

/**
 * Z-Score (ZSCORE)
 * Type: Volatility
 *
 * Expresses how many (population) standard deviations the current input sits away from the
 * average of the last `period` inputs, the current one included. Because a spike is part of its
 * own window, it can score at most the square root of `period - 1`, so a window of 5 inputs never
 * reads beyond 2 and short periods rarely reach the default thresholds.
 *
 * Works on any scalar series: feed closing prices for mean-reversion setups or per-bar volumes
 * to spot unusual participation. Declare which one it reads, so consumers that feed candles
 * pick the right field, because a price and a volume are both plain numbers. Returns `null` when
 * the window has no variance, because distance from normal is undefined when every input was the
 * same.
 *
 * Interpretation:
 * A reading of 0 means the input is exactly average. A reading of 2 or above marks an unusually
 * high input, -2 or below an unusually low one (both thresholds can be customized via the
 * constructor).
 *
 * @see https://en.wikipedia.org/wiki/Standard_score
 */
export class ZScore extends ThresholdCrossSeries {
  override readonly inputShape: InputShapeOf<number>;

  readonly #period: number;
  readonly #values: number[] = [];

  constructor(
    period: number,
    {
      inputShape = IndicatorInputShape.PRICE,
      overbought = 2,
      oversold = -2,
    }: SignalThresholds & {inputShape?: InputShapeOf<number>} = {}
  ) {
    super({overbought, oversold});
    this.inputShape = inputShape;

    if (period < 2) {
      throw new Error(`period must be >= 2, got "${period}"`);
    }

    this.#period = period;
  }

  override getRequiredInputs() {
    return this.#period;
  }

  override update(value: number, replace: boolean) {
    pushUpdate({array: this.#values, item: value, maxLength: this.#period, replace});

    if (this.#values.length < this.#period) {
      return null;
    }

    /*
     * Compare exactly instead of testing for a zero deviation, because floating-point noise
     * turns a flat window of decimals into a tiny deviation and an absurdly large score.
     */
    if (this.#values.every(windowValue => windowValue === value)) {
      // Clear the last score so a stale reading cannot pass for the current one.
      this.result = undefined;
      return null;
    }

    return this.setResult(getZScore(this.#values), replace);
  }
}
