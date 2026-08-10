import {getMaximum} from '../../util/getMaximum.js';
import {getMinimum} from '../../util/getMinimum.js';
import {pushUpdate} from '../../util/pushUpdate.js';
import {MovingAverage} from '../MA/MovingAverage.js';

/**
 * Fractal Adaptive Moving Average (FRAMA)
 * Type: Trend
 *
 * FRAMA was developed by John Ehlers to resolve the fixed tradeoff between smoothness and lag of ordinary moving
 * averages. It estimates the fractal dimension of the price curve — how densely price filled its range over the
 * interval, measured by comparing the ranges of the two window halves against the range of the full window — and
 * turns that roughness into the smoothing of an exponential moving average. Near a fractal dimension of 1 (prices
 * traveled in a straight line) it follows price almost one-to-one; near 2 (dense congestion) it becomes as sluggish
 * as a 200-period moving average, flattening out whipsaws in congestion zones.
 *
 * The interval must be an even number of at least 2, because the fractal dimension is measured over two equal
 * window halves; anything else throws an error. The first result seeds with the price that completes the first
 * full window, matching the paper. When either window half is flat, a straight line (fractal dimension 1) is
 * assumed, so the average snaps to the current price — the same "a flat window is perfectly efficient" convention
 * KAMA follows.
 *
 * Ehlers feeds the median price `(high + low) / 2` into FRAMA; this implementation works on whatever price series
 * it is fed.
 *
 * @see http://www.mesasoftware.com/papers/FRAMA.pdf
 */
export class FRAMA extends MovingAverage {
  readonly #prices: number[] = [];

  constructor(interval: number) {
    super(interval);

    if (interval < 2 || interval % 2 !== 0) {
      throw new Error(`The interval has to be an even number of at least 2, but "${interval}" was given.`);
    }
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    pushUpdate({array: this.#prices, item: price, maxLength: this.interval + 1, replace: replace});

    if (this.#prices.length < this.interval) {
      return null;
    }

    if (this.#prices.length === this.interval) {
      return this.setResult(price, replace);
    }

    const half = this.interval / 2;
    const window = this.#prices.slice(-this.interval);
    const olderHalf = window.slice(0, half);
    const newerHalf = window.slice(half);
    const n1 = (getMaximum(olderHalf) - getMinimum(olderHalf)) / half;
    const n2 = (getMaximum(newerHalf) - getMinimum(newerHalf)) / half;
    const n3 = (getMaximum(window) - getMinimum(window)) / this.interval;

    /*
     * A flat half reads as a straight line (fractal dimension 1). This also rules out taking the
     * logarithm of zero: a fully flat window always contains a flat half.
     */
    const dimension = n1 === 0 || n2 === 0 ? 1 : (Math.log(n1 + n2) - Math.log(n3)) / Math.log(2);

    // Ehlers bounds the smoothing between following the price one-to-one and a very slow average
    const alpha = Math.min(Math.max(Math.exp(-4.6 * (dimension - 1)), 0.01), 1);

    // Guaranteed to exist: the seed result was set as soon as the first window filled up
    const previous = (replace ? this.previousResult : this.result) as number;

    return this.setResult(alpha * price + (1 - alpha) * previous, replace);
  }
}
