import {ZeroCrossSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';

export type APOConfig = {
  /** Number of candles for the fast EMA (default: 12) */
  fastPeriod?: number;
  /** Number of candles for the slow EMA (default: 26) */
  slowPeriod?: number;
};

/**
 * Absolute Price Oscillator (APO)
 * Type: Momentum
 *
 * The APO reports the spread between the fast and slow EMA in the instrument's own price units — it is the
 * MACD line without the signal line. Keeping the price scale makes the reading directly actionable for a
 * single instrument ("the fast average trades $2 above the slow one"), whereas its percentage sibling (PPO)
 * trades that immediacy for comparability across differently priced instruments.
 *
 * Interpretation: readings above zero mean upside momentum, readings below zero mean downside momentum, and
 * zero-line crossings flag a momentum reversal.
 *
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/apo
 * @see https://tulipindicators.org/apo
 */
export class APO extends ZeroCrossSeries {
  readonly #fast: EMA;
  readonly #slow: EMA;

  public readonly fastPeriod: number;
  public readonly slowPeriod: number;

  constructor({fastPeriod = 12, slowPeriod = 26}: APOConfig = {}) {
    super();
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.#fast = new EMA(fastPeriod);
    this.#slow = new EMA(slowPeriod);
  }

  override getRequiredInputs() {
    return this.#slow.getRequiredInputs();
  }

  update(price: number, replace: boolean) {
    const fast = this.#fast.update(price, replace);
    const slow = this.#slow.update(price, replace);

    if (this.#slow.isStable) {
      return this.setResult(fast - slow, replace);
    }

    return null;
  }
}
