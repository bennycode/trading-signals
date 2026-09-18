import type {HighLow} from '../../base/Candle.type.js';
import {IndicatorInputShape, ZeroCrossSeries} from '../../base/Indicator.js';
import {getMaximum} from '../../util/math/getMaximum.js';
import {getMedianPrice} from '../../util/candle/getMedianPrice.js';
import {getMinimum} from '../../util/math/getMinimum.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

/**
 * Fisher Transform (FISHER)
 * Type: Momentum
 *
 * Developed by John F. Ehlers, the Fisher Transform reshapes prices into a nearly Gaussian
 * distribution. It locates each bar's midpoint within the recent high-low range and stretches
 * that position with the inverse hyperbolic tangent, so price extremes turn into sharp,
 * unambiguous peaks and troughs instead of the rounded tops raw prices produce. This makes it
 * popular for spotting reversals earlier than lagging averages.
 *
 * The classic signal line requires no extra calculation: it is simply the Fisher value of the
 * previous bar, so a signal-line crossing occurs whenever the current value passes the prior one.
 *
 * Interpretation: Readings above zero indicate bullish pressure, readings below zero bearish
 * pressure. Extreme swings far away from the zero line mark likely turning points.
 *
 * @see https://www.investopedia.com/terms/f/fisher-transform.asp
 * @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/indicators/fisher.c
 */
export class FisherTransform extends ZeroCrossSeries<HighLow<number>> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW;

  public readonly interval: number;

  readonly #medians: number[] = [];
  #normalized = 0;
  #fisher = 0;
  #previousNormalized = 0;
  #previousFisher = 0;

  constructor(interval: number = 10) {
    super();
    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update({high, low}: HighLow<number>, replace: boolean) {
    /*
     * The normalization and the transform are both recursive, so a replacement has to resume
     * from the values committed before the replaced bar.
     */
    if (replace) {
      this.#normalized = this.#previousNormalized;
      this.#fisher = this.#previousFisher;
    }

    const median = getMedianPrice({high, low});

    pushUpdate({array: this.#medians, item: median, maxLength: this.interval, replace});

    if (this.#medians.length < this.interval) {
      return null;
    }

    this.#previousNormalized = this.#normalized;
    this.#previousFisher = this.#fisher;

    const highest = getMaximum(this.#medians);
    const lowest = getMinimum(this.#medians);
    /*
     * A flat window offers no range to position the bar in, so a nominal range keeps the
     * normalization defined (the same fallback Tulip Indicators uses).
     */
    const range = highest === lowest ? 0.001 : highest - lowest;

    let normalized = 0.33 * 2 * ((median - lowest) / range - 0.5) + 0.67 * this.#normalized;

    /*
     * A bar pinned to the edge of its range would stretch to infinity, so the normalized
     * position is capped just below the poles at ±1.
     */
    if (normalized > 0.99) {
      normalized = 0.999;
    } else if (normalized < -0.99) {
      normalized = -0.999;
    }

    this.#normalized = normalized;
    this.#fisher = 0.5 * Math.log((1 + normalized) / (1 - normalized)) + 0.5 * this.#fisher;

    return this.setResult(this.#fisher, replace);
  }
}
