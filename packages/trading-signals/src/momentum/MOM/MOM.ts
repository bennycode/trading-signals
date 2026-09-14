import {IndicatorInputShape, ZeroCrossSeries} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

/**
 * Momentum Indicator (MOM / MTM)
 * Type: Momentum
 *
 * The Momentum indicator returns the change between the current price and the price n times ago.
 *
 * @see https://en.wikipedia.org/wiki/Momentum_(technical_analysis)
 * @see https://www.warriortrading.com/momentum-indicator/
 */
export class MOM extends ZeroCrossSeries {
  override readonly inputShape = IndicatorInputShape.VALUE;

  readonly #history: number[];
  readonly #historyLength: number;

  public readonly interval: number;

  constructor(interval: number) {
    super();
    this.interval = interval;
    this.#historyLength = interval + 1;
    this.#history = [];
  }

  override getRequiredInputs() {
    return this.#historyLength;
  }

  update(value: number, replace: boolean) {
    pushUpdate({array: this.#history, item: value, maxLength: this.#historyLength, replace: replace});

    if (this.#history.length === this.#historyLength) {
      return this.setResult(value - this.#history[0], replace);
    }

    return null;
  }
}
