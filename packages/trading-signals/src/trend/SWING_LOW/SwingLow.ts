import {IndicatorSeries} from '../../types/Indicator.js';
import type {HighLow} from '../../types/HighLowClose.js';
import {pushUpdate} from '../../util/pushUpdate.js';

export type SwingLowConfig = {
  /**
   * Number of candles on each side of a pivot candle that must have a strictly higher low
   * for the pivot to be confirmed as a swing low. A confirmed pivot is emitted `lookback`
   * candles after the pivot itself, so results lag by that many bars.
   */
  lookback: number;
};

/**
 * Swing Low Detector (SwingLow)
 * Type: Trend
 *
 * Detects swing lows (pivot lows / fractal lows) in a price series. A candle qualifies as
 * a swing low when its low is strictly less than the lows of `lookback` candles on each
 * side. Commonly used to mark support levels, place structure-based stop-losses, and
 * confirm higher-low/lower-low trend structures.
 *
 * @see https://www.investopedia.com/terms/s/swinglow.asp
 * @see https://www.investopedia.com/terms/f/fractal.asp
 */
export class SwingLow extends IndicatorSeries<HighLow> {
  readonly #lookback: number;
  readonly #window: number[] = [];
  #lastEmitted = false;

  constructor(config: SwingLowConfig) {
    super();
    this.#lookback = config.lookback;
  }

  override getRequiredInputs() {
    return 2 * this.#lookback + 1;
  }

  update(candle: HighLow<number>, replace: boolean) {
    // If the bar we're replacing caused the last emission, unwind it up-front so the
    // pivot check evaluates against fresh state and `getResult()` doesn't keep a stale
    // pivot when the replacement no longer qualifies.
    if (replace && this.#lastEmitted) {
      this.rollbackLastResult();
    }
    this.#lastEmitted = false;

    pushUpdate(this.#window, replace, candle.low, this.getRequiredInputs());

    if (this.#window.length < this.getRequiredInputs()) {
      return null;
    }

    const pivot = this.#window[this.#lookback];

    for (let i = 0; i < this.#window.length; i++) {
      if (i === this.#lookback) {
        continue;
      }

      if (this.#window[i] <= pivot) {
        return null;
      }
    }

    this.#lastEmitted = true;
    return this.setResult(pivot, false);
  }
}
