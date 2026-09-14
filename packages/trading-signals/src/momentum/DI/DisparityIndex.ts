import {IndicatorInputShape, ZeroCrossSeries} from '../../base/Indicator.js';
import type {MovingAverage} from '../../trend/MA/MovingAverage.js';
import type {MovingAverageTypes} from '../../trend/MA/MovingAverageTypes.js';
import {SMA} from '../../trend/SMA/SMA.js';

/**
 * Disparity Index (DI)
 * Type: Momentum
 *
 * Measures how far the latest close has stretched above or below its own moving average, expressed
 * as a percentage of that average. Japanese analysts used the disparity between price and its
 * average as a mean-reversion gauge long before Steve Nison introduced the technique to Western
 * chart readers. The percentage scale makes the stretch comparable across differently priced
 * instruments. pandas-ta ships the same calculation under the alias "bias".
 *
 * Interpretation:
 * Readings above zero mean price trades above its average (bullish pressure), readings below zero
 * mean it trades beneath it (bearish pressure). Extreme readings in either direction flag an
 * over-extended move that is prone to snap back toward the average. An average of zero describes a
 * worthless price level, which offers no meaningful deviation to measure, so the oscillator reports
 * the neutral zero line instead.
 *
 * @see https://www.investopedia.com/terms/d/disparityindex.asp
 */
export class DisparityIndex extends ZeroCrossSeries {
  override readonly inputShape = IndicatorInputShape.VALUE;

  readonly #ma: MovingAverage;

  public readonly interval: number;

  constructor(interval: number = 14, SmoothingIndicator: MovingAverageTypes = SMA) {
    super();
    this.interval = interval;
    this.#ma = new SmoothingIndicator(interval);
  }

  override getRequiredInputs() {
    return this.#ma.getRequiredInputs();
  }

  update(close: number, replace: boolean) {
    this.#ma.update(close, replace);

    if (this.#ma.isStable) {
      const average = this.#ma.getResultOrThrow();

      if (average === 0) {
        return this.setResult(0, replace);
      }

      return this.setResult((100 * (close - average)) / average, replace);
    }

    return null;
  }
}
