import {MovingAverage} from '../MA/MovingAverage.js';
import {WMA} from '../WMA/WMA.js';

/**
 * Hull Moving Average (HMA)
 * Type: Trend
 *
 * The Hull Moving Average was developed by Alan Hull to solve the classic moving average dilemma: smoothing out
 * noise always adds lag, and reducing lag always adds noise. The HMA amplifies recent price action by subtracting a
 * full-period WMA from a doubled half-period WMA, then smooths the result with a WMA over the square root of the
 * interval — tracking price nearly in real time while staying smooth.
 *
 * The half and square-root periods are truncated to integers, matching Tulip Indicators.
 *
 * @see https://alanhull.com/the-hull-moving-average/
 * @see https://tulipindicators.org/hma
 */
export class HMA extends MovingAverage {
  readonly #wmaHalf: WMA;
  readonly #wmaFull: WMA;
  readonly #wmaSqrt: WMA;

  constructor(interval: number) {
    super(interval);
    this.#wmaHalf = new WMA(Math.floor(interval / 2));
    this.#wmaFull = new WMA(interval);
    this.#wmaSqrt = new WMA(Math.floor(Math.sqrt(interval)));
  }

  override getRequiredInputs() {
    return this.#wmaFull.getRequiredInputs() + this.#wmaSqrt.getRequiredInputs() - 1;
  }

  update(price: number, replace: boolean) {
    const half = this.#wmaHalf.update(price, replace);
    const full = this.#wmaFull.update(price, replace);

    if (half !== null && full !== null) {
      const lagReduced = 2 * half - full;
      const result = this.#wmaSqrt.update(lagReduced, replace);

      if (result !== null) {
        return this.setResult(result, replace);
      }
    }

    return null;
  }
}
