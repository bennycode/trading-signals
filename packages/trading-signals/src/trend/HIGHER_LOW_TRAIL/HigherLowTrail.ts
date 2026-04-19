import {IndicatorSeries} from '../../types/Indicator.js';
import type {HighLow} from '../../types/HighLowClose.js';

export type HigherLowTrailConfig = {
  /**
   * Number of candles of strictly-higher-low confirmation required on the right side of a
   * candidate bar. Unlike a symmetric swing-low detector, there is no left-side lookback —
   * any bar whose low is strictly less than the next `lookback` lows counts as a pullback
   * low, even if prior bars had lower lows.
   */
  lookback: number;
  /**
   * When `true` (default), the trail only ever rises — candidate pullback lows at or below
   * the current trail are ignored. Set to `false` to emit every one-sided pullback low.
   */
  monotonic?: boolean;
};

/**
 * Higher-Low Trail (HigherLowTrail)
 * Type: Trend
 *
 * Tracks a rising stop-loss level by detecting pullback lows through one-sided confirmation:
 * a candle is a pullback low when the next `lookback` candles all print strictly higher lows.
 * When `monotonic` is enabled (the default), the emitted level only rises — pullback lows
 * below the current trail are skipped, which is the behavior you want when wiring the output
 * to a trailing-stop order on a long position.
 *
 * Compared to `SwingLow` (symmetric fractal), this responds faster at the cost of occasionally
 * tracking a low that a later bar undercuts. Compared to a simple N-bar low, it filters for
 * actual reversals rather than arbitrary local minima.
 */
export class HigherLowTrail extends IndicatorSeries<HighLow> {
  readonly #lookback: number;
  readonly #monotonic: boolean;
  readonly #window: number[] = [];

  constructor(config: HigherLowTrailConfig) {
    super();
    this.#lookback = config.lookback;
    this.#monotonic = config.monotonic ?? true;
  }

  override getRequiredInputs() {
    return this.#lookback + 1;
  }

  update(candle: HighLow<number>, replace: boolean) {
    if (replace && this.#window.length > 0) {
      this.#window[this.#window.length - 1] = candle.low;
    } else {
      this.#window.push(candle.low);
    }

    const required = this.getRequiredInputs();

    if (this.#window.length < required) {
      return null;
    }

    while (this.#window.length > required) {
      this.#window.shift();
    }

    const pivot = this.#window[0];

    for (let i = 1; i < this.#window.length; i++) {
      if (this.#window[i] <= pivot) {
        return null;
      }
    }

    const currentTrail = replace ? this.previousResult : this.result;

    if (this.#monotonic && currentTrail !== undefined && pivot <= currentTrail) {
      return null;
    }

    return this.setResult(pivot, replace);
  }
}
