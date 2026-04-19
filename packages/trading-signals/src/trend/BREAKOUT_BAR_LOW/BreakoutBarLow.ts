import {IndicatorSeries} from '../../types/Indicator.js';
import type {HighLow} from '../../types/HighLowClose.js';

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

  constructor(config: BreakoutBarLowConfig) {
    super();
    this.#lookback = config.lookback;
  }

  override getRequiredInputs() {
    return this.#lookback + 1;
  }

  update(candle: HighLow<number>, replace: boolean) {
    if (replace && this.#highs.length > 0) {
      this.#highs[this.#highs.length - 1] = candle.high;
    } else {
      this.#highs.push(candle.high);
    }

    const required = this.getRequiredInputs();

    while (this.#highs.length > required) {
      this.#highs.shift();
    }

    if (this.#highs.length < required) {
      return null;
    }

    const currentHigh = this.#highs[this.#highs.length - 1];
    let maxPriorHigh = this.#highs[0];

    for (let i = 1; i < this.#highs.length - 1; i++) {
      if (this.#highs[i] > maxPriorHigh) {
        maxPriorHigh = this.#highs[i]!;
      }
    }

    if (currentHigh > maxPriorHigh) {
      return this.setResult(candle.low, replace);
    }

    return null;
  }
}
