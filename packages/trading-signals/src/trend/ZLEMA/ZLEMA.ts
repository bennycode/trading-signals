import {MovingAverage} from '../MA/MovingAverage.js';
import {NotEnoughDataError} from '../../error/index.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Zero-Lag Exponential Moving Average (ZLEMA)
 * Type: Trend
 *
 * Proposed by John Ehlers and Ric Way, the ZLEMA strips most of the lag from a classic EMA by
 * amplifying the newest price with its gain over the price from half an interval ago, and only then
 * smoothing that de-lagged price. The average therefore hugs turning points that a plain EMA
 * reaches several bars later.
 *
 * Seeding of the smoothing matches Tulip Indicators.
 *
 * @see https://en.wikipedia.org/wiki/Zero_lag_exponential_moving_average
 * @see https://tulipindicators.org/zlema
 */
export class ZLEMA extends MovingAverage {
  #pricesCounter = 0;
  readonly #lag: number;
  readonly #prices: number[] = [];
  readonly #weightFactor: number;

  constructor(interval: number) {
    super(interval);
    this.#lag = Math.floor((interval - 1) / 2);
    this.#weightFactor = 2 / (interval + 1);
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    if (!replace || this.#pricesCounter === 0) {
      this.#pricesCounter++;
    }

    pushUpdate({array: this.#prices, item: price, maxLength: this.#lag + 1, replace});

    if (this.#pricesCounter < this.#lag) {
      return null;
    }

    const previousSmoothed = replace ? this.previousResult : this.result;
    const deLaggedPrice = 2 * price - this.#prices[0];

    let smoothed: number;

    if (this.#pricesCounter === this.#lag) {
      // Tulip Indicators seeds the smoothing with the raw price of the last bar for which no de-lagged price exists yet
      smoothed = price;
    } else if (previousSmoothed === undefined) {
      // Without lag to compensate (interval <= 2), the very first de-lagged price seeds the smoothing
      smoothed = deLaggedPrice;
    } else {
      smoothed = (deLaggedPrice - previousSmoothed) * this.#weightFactor + previousSmoothed;
    }

    this.setResult(smoothed, replace);

    return this.#pricesCounter < this.interval ? null : smoothed;
  }

  override getResultOrThrow() {
    if (this.#pricesCounter < this.interval) {
      throw new NotEnoughDataError(this.getRequiredInputs());
    }

    return super.getResultOrThrow();
  }

  override get isStable() {
    return this.#pricesCounter >= this.interval;
  }
}
