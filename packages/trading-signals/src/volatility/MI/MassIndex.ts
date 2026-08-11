import type {HighLow} from '../../base/Candle.type.js';
import {IndicatorSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

/**
 * Mass Index (MI)
 * Type: Volatility
 *
 * The Mass Index was developed by Donald Dorsey (1992) to anticipate trend reversals by watching the high-low range
 * widen: a swelling range suggests the conviction behind the current trend is eroding. The range is smoothed twice
 * with a 9-bar EMA (both spans fixed by Dorsey), and the ratio of the single-smoothed to the double-smoothed range
 * is summed over the interval. Range expansion inflates the reading no matter which way the market moves.
 *
 * Interpretation:
 * Dorsey's "reversal bulge" forms when the 25-bar Mass Index rises above 27 and then falls back below 26.5, marking
 * a likely trend change. The bulge carries no directional information — the same pattern precedes tops and bottoms
 * alike — which is why this indicator emits no trading signal; direction has to come from a trend-following
 * companion such as a moving average.
 *
 * @see https://www.investopedia.com/terms/m/mass-index.asp
 * @see https://tulipindicators.org/mass
 */
export class MassIndex extends IndicatorSeries<HighLow> {
  readonly #single: EMA;
  readonly #double: EMA;
  readonly #ratios: number[] = [];

  public readonly interval: number;

  constructor(interval: number = 25) {
    super();
    this.interval = interval;
    this.#single = new EMA(9);
    this.#double = new EMA(9);
  }

  override getRequiredInputs() {
    const firstRatio = this.#single.getRequiredInputs() + this.#double.getRequiredInputs() - 1;
    return firstRatio + this.interval - 1;
  }

  update(candle: HighLow, replace: boolean) {
    const single = this.#single.update(candle.high - candle.low, replace);

    /*
     * The second smoothing pass starts only once the first pass reflects a full period (mirroring
     * Tulip Indicators). Feeding it earlier would seed it with a half-formed average and shift
     * every subsequent reading.
     */
    if (!this.#single.isStable) {
      return null;
    }

    const double = this.#double.update(single, replace);

    if (!this.#double.isStable) {
      return null;
    }

    /*
     * A market whose candles never trade a range keeps both smoothing passes at zero. A constant
     * range of any size reads exactly 1, so the dead-market limit is 1 (no expansion) instead of
     * a division by zero poisoning the sum.
     */
    const ratio = double === 0 ? 1 : single / double;

    pushUpdate({array: this.#ratios, item: ratio, maxLength: this.interval, replace});

    if (this.#ratios.length === this.interval) {
      return this.setResult(
        this.#ratios.reduce((sum, ratio) => sum + ratio, 0),
        replace
      );
    }

    return null;
  }
}
