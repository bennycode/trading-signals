import {MovingAverage} from '../MA/MovingAverage.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

/**
 * Arnaud Legoux Moving Average (ALMA)
 * Type: Trend
 *
 * Weights the price window with a Gaussian bell whose peak is shifted toward the newest prices,
 * tackling the classic moving average trade-off between responsiveness and smoothness: prices
 * near the peak dominate the average (low lag) while the bell's tails still dampen outliers
 * (smoothness). The offset (0 to 1) positions the peak within the window — higher values hug
 * recent price action more closely — and sigma controls the bell's width — larger values spread
 * the weight for a smoother line. Arnaud Legoux and Dimitrios Kouzis-Loukas proposed offset 0.85
 * and sigma 6 as a balanced default in 2009.
 *
 * @see https://www.tradingview.com/support/solutions/43000594683-arnaud-legoux-moving-average/
 * @see https://dotnet.stockindicators.dev/indicators/Alma/
 */
export class ALMA extends MovingAverage {
  public readonly prices: number[] = [];
  readonly #weights: number[] = [];
  readonly #totalWeight: number;

  constructor(interval: number, offset: number = 0.85, sigma: number = 6) {
    super(interval);

    /*
     * The bell never changes once configured, so its weights are laid out up front:
     * the peak sits at the offset position within the window and sigma sets the spread.
     */
    const peak = offset * (interval - 1);
    const spread = interval / sigma;
    let totalWeight = 0;

    for (let i = 0; i < interval; i++) {
      const weight = Math.exp(-((i - peak) ** 2) / (2 * spread ** 2));
      this.#weights.push(weight);
      totalWeight += weight;
    }

    this.#totalWeight = totalWeight;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    pushUpdate({array: this.prices, item: price, maxLength: this.interval, replace: replace});

    if (this.prices.length === this.interval) {
      const weightedSum = this.prices.reduce((sum, value, index) => sum + value * this.#weights[index], 0);

      return this.setResult(weightedSum / this.#totalWeight, replace);
    }

    return null;
  }
}
