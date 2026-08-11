import {MovingAverage} from '../MA/MovingAverage.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Triangular Moving Average (TRIMA)
 * Type: Trend
 *
 * The Triangular Moving Average weights the middle of the interval most heavily, tapering off symmetrically towards both the oldest and the newest price. This is equivalent to smoothing a Simple Moving Average with a second Simple Moving Average, which makes the TRIMA noticeably smoother — and slower to react — than an SMA over the same interval. Traders reach for it when reading the underlying trend direction matters more than reacting quickly, since the double smoothing filters out most short-lived noise.
 *
 * @see https://tulipindicators.org/trima
 * @see https://www.fmlabs.com/reference/default.htm?url=TriangularMA.htm
 */
export class TRIMA extends MovingAverage {
  public readonly prices: number[] = [];
  readonly #divisor: number;

  constructor(interval: number) {
    super(interval);

    /*
     * Total triangular weight in closed form: an even interval repeats the peak weight
     * (e.g. 1-2-3-3-2-1), an odd interval peaks once (e.g. 1-2-3-2-1).
     */
    const half = Math.trunc(interval / 2);
    this.#divisor = interval % 2 === 0 ? (half + 1) * half : (half + 1) ** 2;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    pushUpdate({array: this.prices, item: price, maxLength: this.interval, replace: replace});

    if (this.prices.length === this.interval) {
      const weightedSum = this.prices.reduce(
        (sum, value, index) => sum + value * Math.min(index + 1, this.interval - index),
        0
      );

      return this.setResult(weightedSum / this.#divisor, replace);
    }

    return null;
  }
}
