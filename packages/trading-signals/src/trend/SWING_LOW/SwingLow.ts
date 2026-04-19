import {IndicatorSeries} from '../../types/Indicator.js';
import type {HighLow} from '../../types/HighLowClose.js';

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

  constructor(config: SwingLowConfig) {
    super();
    this.#lookback = config.lookback;
  }

  override getRequiredInputs() {
    return 2 * this.#lookback + 1;
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

    const pivot = this.#window[this.#lookback]!;

    for (let i = 0; i < this.#window.length; i++) {
      if (i === this.#lookback) {
        continue;
      }

      if (this.#window[i]! <= pivot) {
        return null;
      }
    }

    return this.setResult(pivot, replace);
  }
}
