import {IndicatorSeries} from '../../types/Indicator.js';
import type {HighLow} from '../../types/HighLowClose.js';

export type SwingHighConfig = {
  /**
   * Number of candles on each side of a pivot candle that must have a strictly lower high
   * for the pivot to be confirmed as a swing high. A confirmed pivot is emitted `lookback`
   * candles after the pivot itself, so results lag by that many bars.
   */
  lookback: number;
};

/**
 * Swing High Detector (SwingHigh)
 * Type: Trend
 *
 * Detects swing highs (pivot highs / fractal highs) in a price series. A candle qualifies
 * as a swing high when its high is strictly greater than the highs of `lookback` candles
 * on each side. Commonly used to mark resistance levels, identify breakout targets, and
 * confirm higher-high/lower-high trend structures.
 *
 * @see https://www.investopedia.com/terms/s/swinghigh.asp
 * @see https://www.investopedia.com/terms/f/fractal.asp
 */
export class SwingHigh extends IndicatorSeries<HighLow> {
  readonly #lookback: number;
  readonly #window: number[] = [];

  constructor(config: SwingHighConfig) {
    super();
    this.#lookback = config.lookback;
  }

  override getRequiredInputs() {
    return 2 * this.#lookback + 1;
  }

  update(candle: HighLow<number>, replace: boolean) {
    if (replace && this.#window.length > 0) {
      this.#window[this.#window.length - 1] = candle.high;
    } else {
      this.#window.push(candle.high);
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

      if (this.#window[i]! >= pivot) {
        return null;
      }
    }

    return this.setResult(pivot, replace);
  }
}
