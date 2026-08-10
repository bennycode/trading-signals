import {ZeroCrossSeries} from '../../base/Indicator.js';
import {WMA} from '../../trend/WMA/WMA.js';
import {ROC} from '../ROC/ROC.js';

export type CoppockCurveConfig = {
  /** Number of candles for the longer rate-of-change look-back (default: 14) */
  longRocInterval?: number;
  /** Number of candles for the shorter rate-of-change look-back (default: 11) */
  shortRocInterval?: number;
  /** Number of momentum readings smoothed by the weighted moving average (default: 10) */
  wmaInterval?: number;
};

/**
 * Coppock Curve (COPPOCK)
 * Type: Momentum
 *
 * Economist Edwin "Sedge" Coppock published this oscillator in Barron's in 1962 after the Episcopal
 * Church asked him for a long-term buying guide. He set the look-backs to 11 and 14 months because the
 * church's bishops estimated mourning a bereavement takes that long, and he expected market recoveries
 * to follow the same rhythm as recoveries from grief. The long look-backs and the heavy smoothing
 * deliberately ignore rallies inside a bear market: the indicator was designed on monthly bars to flag
 * major market bottoms, not short-lived bounces. It works on any timeframe, but reacts slowly by design.
 *
 * Interpretation: A curve above zero reports bullish long-term momentum, below zero bearish momentum.
 * The classic entry popularized by Coppock is an upturn of the curve while it is still below zero,
 * marking the start of a recovery from a major low.
 *
 * @see https://en.wikipedia.org/wiki/Coppock_curve
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:coppock_curve
 */
export class CoppockCurve extends ZeroCrossSeries {
  readonly #longRoc: ROC;
  readonly #shortRoc: ROC;
  readonly #wma: WMA;

  public readonly longRocInterval: number;
  public readonly shortRocInterval: number;
  public readonly wmaInterval: number;

  constructor({longRocInterval = 14, shortRocInterval = 11, wmaInterval = 10}: CoppockCurveConfig = {}) {
    super();
    this.longRocInterval = longRocInterval;
    this.shortRocInterval = shortRocInterval;
    this.wmaInterval = wmaInterval;
    this.#longRoc = new ROC(longRocInterval);
    this.#shortRoc = new ROC(shortRocInterval);
    this.#wma = new WMA(wmaInterval);
  }

  override getRequiredInputs() {
    // The smoothing only starts once the slower of the two momentum windows has filled.
    const slowestRoc = Math.max(this.#longRoc.getRequiredInputs(), this.#shortRoc.getRequiredInputs());

    return slowestRoc + this.#wma.getRequiredInputs() - 1;
  }

  update(price: number, replace: boolean) {
    const longRoc = this.#longRoc.update(price, replace);
    const shortRoc = this.#shortRoc.update(price, replace);

    if (longRoc !== null && shortRoc !== null) {
      // The momentum readings are fractions, but the curve is quoted in percentage points.
      const coppock = this.#wma.update((longRoc + shortRoc) * 100, replace);

      if (coppock !== null) {
        return this.setResult(coppock, replace);
      }
    }

    return null;
  }
}
