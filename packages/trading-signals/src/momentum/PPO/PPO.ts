import {ZeroCrossTrendIndicatorSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';

export type PPOConfig = {
  /** Number of candles for the fast EMA (default: 12) */
  fastPeriod?: number;
  /** Number of candles for the slow EMA (default: 26) */
  slowPeriod?: number;
};

/**
 * Percentage Price Oscillator (PPO)
 * Type: Momentum
 *
 * The PPO is the MACD's percentage sibling: it divides the spread between the fast and slow EMA by the slow EMA
 * instead of reporting it in absolute price units. That makes readings comparable across differently priced
 * instruments and across long time ranges of the same instrument — a $2 MACD spread means something entirely
 * different at a $20 price than at a $2,000 price, while a 1% PPO reads the same everywhere.
 *
 * @see https://www.investopedia.com/terms/p/ppo.asp
 * @see https://tulipindicators.org/ppo
 */
export class PPO extends ZeroCrossTrendIndicatorSeries {
  readonly #fast: EMA;
  readonly #slow: EMA;

  public readonly fastPeriod: number;
  public readonly slowPeriod: number;

  constructor({fastPeriod = 12, slowPeriod = 26}: PPOConfig = {}) {
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
      return this.setResult((100 * (fast - slow)) / slow, replace);
    }

    return null;
  }
}
