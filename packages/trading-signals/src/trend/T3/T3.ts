import {EMA} from '../EMA/EMA.js';
import {MovingAverage} from '../MA/MovingAverage.js';

/**
 * Tillson T3 Moving Average (T3)
 * Type: Trend
 *
 * The T3 was developed by Tim Tillson to give trend followers a smooth curve that still turns quickly:
 * it applies his "generalized DEMA" three times, which expands into a weighted blend of six cascaded
 * EMAs. The volume factor (unrelated to trade volume) steers each stage between a plain EMA (0) and a
 * full DEMA (1) — higher values hug price more closely at the cost of overshoot. Tillson recommends 0.7.
 *
 * The chain is staged — each EMA starts only once the previous one is stable, seeding itself with that
 * EMA's first stable value — following the same convention as TEMA. TA-Lib seeds each stage with an SMA
 * instead, so early readings differ slightly from TA-Lib until the seed influence decays.
 *
 * @see Tim Tillson, "Smoothing Techniques for More Accurate Signals", Technical Analysis of Stocks & Commodities (January 1998)
 * @see https://www.fmlabs.com/reference/default.htm?url=T3.htm
 * @see https://www.tadoc.org/indicator/T3.htm
 */
export class T3 extends MovingAverage {
  readonly #ema1: EMA;
  readonly #ema2: EMA;
  readonly #ema3: EMA;
  readonly #ema4: EMA;
  readonly #ema5: EMA;
  readonly #ema6: EMA;

  readonly #c1: number;
  readonly #c2: number;
  readonly #c3: number;
  readonly #c4: number;

  public readonly volumeFactor: number;

  constructor(interval: number, volumeFactor: number = 0.7) {
    super(interval);
    this.volumeFactor = volumeFactor;
    this.#ema1 = new EMA(interval);
    this.#ema2 = new EMA(interval);
    this.#ema3 = new EMA(interval);
    this.#ema4 = new EMA(interval);
    this.#ema5 = new EMA(interval);
    this.#ema6 = new EMA(interval);

    const a = volumeFactor;
    this.#c1 = -(a ** 3);
    this.#c2 = 3 * a ** 2 + 3 * a ** 3;
    this.#c3 = -6 * a ** 2 - 3 * a - 3 * a ** 3;
    this.#c4 = 1 + 3 * a + a ** 3 + 3 * a ** 2;
  }

  override getRequiredInputs() {
    return 6 * (this.interval - 1) + 1;
  }

  update(price: number, replace: boolean) {
    const ema1 = this.#ema1.update(price, replace);

    if (!this.#ema1.isStable) {
      return null;
    }

    const ema2 = this.#ema2.update(ema1, replace);

    if (!this.#ema2.isStable) {
      return null;
    }

    const ema3 = this.#ema3.update(ema2, replace);

    if (!this.#ema3.isStable) {
      return null;
    }

    const ema4 = this.#ema4.update(ema3, replace);

    if (!this.#ema4.isStable) {
      return null;
    }

    const ema5 = this.#ema5.update(ema4, replace);

    if (!this.#ema5.isStable) {
      return null;
    }

    const ema6 = this.#ema6.update(ema5, replace);

    if (!this.#ema6.isStable) {
      return null;
    }

    return this.setResult(this.#c1 * ema6 + this.#c2 * ema5 + this.#c3 * ema4 + this.#c4 * ema3, replace);
  }
}
