import {MovingAverage} from '../MA/MovingAverage.js';
import {NotEnoughDataError} from '../../error/index.js';

/**
 * Exponential Moving Average (EMA)
 * Type: Trend
 *
 * Compared to SMA, the EMA puts more emphasis on the recent prices to reduce lag. Due to its responsiveness to price changes, it rises faster and falls faster than the SMA when the price is inclining or declining.
 *
 * @see https://www.investopedia.com/terms/e/ema.asp
 */
export class EMA extends MovingAverage {
  #pricesCounter = 0;
  readonly #weightFactor: number;
  override readonly interval: number;

  constructor(interval: number) {
    super(interval);
    this.interval = interval;
    this.#weightFactor = 2 / (this.interval + 1);
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    if (!replace || this.#pricesCounter === 0) {
      this.#pricesCounter++;
    }

    /*
     * The smoothing continues from the reading that existed before the incoming price. A replacement
     * of the very first price finds no such reading: that price seeded the average, so the average
     * has to be seeded anew instead of blending with the seed it replaces.
     */
    const previous = replace ? this.previousResult : this.result;

    return this.setResult(price * this.#weightFactor + (previous ?? price) * (1 - this.#weightFactor), replace);
  }

  override getResultOrThrow() {
    if (this.#pricesCounter < this.interval) {
      throw new NotEnoughDataError(this.getRequiredInputs());
    }

    return this.result!;
  }

  override get isStable() {
    try {
      this.getResultOrThrow();
      return true;
    } catch {
      return false;
    }
  }
}
