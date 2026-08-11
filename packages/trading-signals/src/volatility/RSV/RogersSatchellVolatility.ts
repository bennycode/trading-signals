import type {OpenHighLowClose} from '../../base/Candle.type.js';
import {IndicatorSeries} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/index.js';

/**
 * Rogers-Satchell Volatility (RSV)
 * Type: Volatility
 *
 * Published by Leonard Rogers and Stephen Satchell in 1991, this estimator reads volatility from
 * the full candle instead of only its close. Each bar contributes a variance estimate built from
 * how far its extremes stray from open and close — the log range from high to close times the log
 * range from high to open, plus the same product built from the low — and the reading is the root
 * of the mean contribution over the window. Anchoring every range at both open and close makes the
 * estimator drift-independent: a bar that runs in a straight line from an open at one extreme to a
 * close at the other reads as pure drift (zero volatility), where estimators that assume the price
 * ends where it started (Parkinson, Garman-Klass) overstate trending bars. It complements the
 * close-to-close standard deviation, which is blind to everything that happens inside a bar.
 * Because a single candle already carries a full variance estimate, any interval down to 1 is
 * valid.
 *
 * Volatility measures the magnitude of price movement, not its direction, so — like the Ulcer
 * Index — this indicator emits no trading signal.
 *
 * Prices must be positive, since the estimator is built on log ranges. A candle carrying a zero or
 * negative price component has no defined log range and reads as contributing no volatility, so a
 * single broken bar cannot poison the whole window. Valid candles always contribute a non-negative
 * variance estimate — the high sits at or above open and close, the low at or below — so the root
 * is always defined.
 *
 * @see https://doi.org/10.1214/aoap/1177005835
 * @see https://portfolioslab.com/tools/rogers-satchell
 */
export class RogersSatchellVolatility extends IndicatorSeries<OpenHighLowClose> {
  readonly #barVariances: number[] = [];

  public readonly interval: number;

  constructor(interval: number = 14) {
    super();

    if (interval < 1) {
      throw new Error(`interval must be >= 1, got "${interval}"`);
    }

    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update({close, high, low, open}: OpenHighLowClose, replace: boolean) {
    // Log ranges are undefined at zero or negative prices, so such a bar reads as no measurable volatility
    const barVariance =
      Math.min(close, high, low, open) <= 0
        ? 0
        : Math.log(high / close) * Math.log(high / open) + Math.log(low / close) * Math.log(low / open);

    pushUpdate({array: this.#barVariances, item: barVariance, maxLength: this.interval, replace});

    if (this.#barVariances.length < this.interval) {
      return null;
    }

    let varianceSum = 0;

    for (const variance of this.#barVariances) {
      varianceSum += variance;
    }

    return this.setResult(Math.sqrt(varianceSum / this.interval), replace);
  }
}
