import {IndicatorSeries} from '../../types/Indicator.js';
import type {HighLow} from '../../types/HighLowClose.js';
import {pushUpdate} from '../../util/pushUpdate.js';

export type BreakoutBarLowConfig = {
  /**
   * Number of prior candles whose highs the current candle's high must strictly exceed for
   * the current candle to qualify as a breakout bar.
   */
  lookback: number;
};

/**
 * Breakout Bar Low (BreakoutBarLow)
 * Type: Trend
 *
 * Emits the low of each candle that breaks above the highest high of the prior `lookback`
 * candles — a "breakout bar". The breakout bar's intraday low is commonly used as a
 * momentum-based stop reference: if price trades back below it, the breakout is failing
 * and the rationale for entering long is invalidated.
 *
 * Complements `SwingLow` (structural support) and `HigherLowTrail` (pullback support) as a
 * third stop concept driven purely by the breakout candle itself, not by surrounding
 * pivots. Unlike those two, it fires the same bar the breakout prints — no confirmation lag.
 */
export class BreakoutBarLow extends IndicatorSeries<HighLow> {
  readonly #lookback: number;
  readonly #highs: number[] = [];
  #lastEmitted = false;

  constructor(config: BreakoutBarLowConfig) {
    super();
    this.#lookback = config.lookback;
  }

  override getRequiredInputs() {
    return this.#lookback + 1;
  }

  update(candle: HighLow<number>, replace: boolean) {
    // If the bar being replaced produced the last emission, unwind it up-front so
    // `getResult()` doesn't keep a stale breakout low when the replacement no longer
    // qualifies as a breakout.
    if (replace && this.#lastEmitted) {
      this.rollbackLastResult();
    }
    this.#lastEmitted = false;

    pushUpdate(this.#highs, replace, candle.high, this.getRequiredInputs());

    if (this.#highs.length < this.getRequiredInputs()) {
      return null;
    }

    const currentHigh = this.#highs[this.#highs.length - 1];
    let maxPriorHigh = this.#highs[0];

    for (let i = 1; i < this.#highs.length - 1; i++) {
      if (this.#highs[i] > maxPriorHigh) {
        maxPriorHigh = this.#highs[i];
      }
    }

    if (currentHigh > maxPriorHigh) {
      this.#lastEmitted = true;
      return this.setResult(candle.low, false);
    }

    return null;
  }
}
