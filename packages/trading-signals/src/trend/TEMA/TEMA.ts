import {IndicatorSeries} from '../../base/Indicator.js';
import {EMA} from '../EMA/EMA.js';

/**
 * Triple Exponential Moving Average (TEMA)
 * Type: Trend
 *
 * The TEMA was developed by Patrick G. Mulloy as the next step after his DEMA: it combines a single, double and
 * triple smoothed EMA (3×EMA − 3×EMA² + EMA³) to cancel out even more of the lag that stacking EMAs would normally
 * add, hugging price more closely than both EMA and DEMA.
 *
 * The chain is staged — each EMA starts only once the previous one is stable, seeding itself with that EMA's first
 * stable value — matching Tulip Indicators.
 *
 * @see https://www.investopedia.com/terms/t/triple-exponential-moving-average.asp
 * @see https://tulipindicators.org/tema
 */
export class TEMA extends IndicatorSeries {
  readonly #single: EMA;
  readonly #double: EMA;
  readonly #triple: EMA;

  public readonly interval: number;

  constructor(interval: number) {
    super();
    this.interval = interval;
    this.#single = new EMA(interval);
    this.#double = new EMA(interval);
    this.#triple = new EMA(interval);
  }

  override getRequiredInputs() {
    return 3 * (this.interval - 1) + 1;
  }

  update(price: number, replace: boolean) {
    const single = this.#single.update(price, replace);

    if (this.#single.isStable) {
      const double = this.#double.update(single, replace);

      if (this.#double.isStable) {
        const triple = this.#triple.update(double, replace);

        if (this.#triple.isStable) {
          return this.setResult(3 * single - 3 * double + triple, replace);
        }
      }
    }

    return null;
  }
}
