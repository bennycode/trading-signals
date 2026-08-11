import {MovingAverage} from '../MA/MovingAverage.js';
import {NotEnoughDataError} from '../../error/index.js';

/**
 * Relative Moving Average (RMA)
 * Type: Trend
 *
 * Use RMA to identify bullish or bearish trends. It provides a smoother curve compared to SMA and EMA, reacting more slowly to price changes.
 *
 * @see https://www.tradingcode.net/tradingview/ema-versus-rma/
 * @see https://www.tradingcode.net/tradingview/relative-moving-average/#calculation-process
 */
export class RMA extends MovingAverage {
  #pricesCounter = 0;
  readonly #weightFactor: number;
  override readonly interval: number;

  constructor(interval: number) {
    super(interval);
    this.interval = interval;
    this.#weightFactor = 1 / this.interval;
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
