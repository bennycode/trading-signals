import {MovingAverage} from '../MA/MovingAverage.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Kaufman's Adaptive Moving Average (KAMA)
 * Type: Trend
 *
 * KAMA was developed by Perry Kaufman to solve the fixed-speed problem of ordinary moving averages: a fast MA whipsaws
 * in sideways markets, a slow MA lags in trends. KAMA measures how efficiently price traveled over the interval
 * (net change relative to the sum of all interim moves) and adapts its smoothing between a fast EMA constant (2
 * periods) in clean trends and a slow one (30 periods) in noise.
 *
 * The first result seeds with the closing price of the first full window, matching Tulip Indicators.
 *
 * @see https://www.investopedia.com/terms/k/kaufmansadaptivemovingaverage.asp
 * @see https://tulipindicators.org/kama
 */
export class KAMA extends MovingAverage {
  static readonly #FAST = 2 / (2 + 1);
  static readonly #SLOW = 2 / (30 + 1);

  readonly #prices: number[] = [];

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    pushUpdate(this.#prices, replace, price, this.interval + 1);

    if (this.#prices.length < this.interval) {
      return null;
    }

    if (this.#prices.length === this.interval) {
      return this.setResult(price, replace);
    }

    let volatility = 0;

    for (let i = 1; i < this.#prices.length; i++) {
      volatility += Math.abs(this.#prices[i] - this.#prices[i - 1]);
    }

    const netChange = Math.abs(price - this.#prices[0]);
    // A flat window is perfectly efficient: there was no noise to smooth out
    const efficiencyRatio = volatility === 0 ? 1 : netChange / volatility;
    const smoothing = (efficiencyRatio * (KAMA.#FAST - KAMA.#SLOW) + KAMA.#SLOW) ** 2;
    // Guaranteed to exist: the seed result was set as soon as the first window filled up
    const previous = (replace ? this.previousResult : this.result) as number;

    return this.setResult(previous + smoothing * (price - previous), replace);
  }
}
