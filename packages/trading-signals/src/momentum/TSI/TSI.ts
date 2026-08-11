import {ZeroCrossSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';

export type TSIConfig = {
  /** Number of candles for the first, slower smoothing of momentum (default: 25) */
  longPeriod?: number;
  /** Number of candles for the second, faster smoothing (default: 13) */
  shortPeriod?: number;
};

/**
 * True Strength Index (TSI)
 * Type: Momentum
 *
 * The TSI was developed by William Blau and double-smooths the bar-to-bar price change: an EMA over the long period,
 * re-smoothed with an EMA over the short period. Dividing the smoothed momentum by the equally smoothed absolute
 * momentum bounds the reading between -100 and +100 — near the extremes almost every bar in memory moved in the same
 * direction, while readings near zero mean gains and losses cancel out.
 *
 * Interpretation: Above zero, buyers dominate; below zero, sellers dominate — zero-line crossings mark momentum
 * changing sides. A perfectly flat market has no strength in either direction, so the indicator reports 0 instead of
 * dividing zero by zero.
 *
 * The EMAs seed with their first input (this library's convention). Implementations that seed with an SMA (e.g.
 * Skender.Stock.Indicators) report different readings until the seeding transient has decayed.
 *
 * @see https://en.wikipedia.org/wiki/True_strength_index
 * @see https://www.investopedia.com/terms/t/tsi.asp
 */
export class TSI extends ZeroCrossSeries {
  readonly #longMomentum: EMA;
  readonly #longAbsMomentum: EMA;
  readonly #shortMomentum: EMA;
  readonly #shortAbsMomentum: EMA;
  #previousPrice?: number;
  #penultimatePrice?: number;

  public readonly longPeriod: number;
  public readonly shortPeriod: number;

  constructor({longPeriod = 25, shortPeriod = 13}: TSIConfig = {}) {
    super();
    this.longPeriod = longPeriod;
    this.shortPeriod = shortPeriod;
    this.#longMomentum = new EMA(longPeriod);
    this.#longAbsMomentum = new EMA(longPeriod);
    this.#shortMomentum = new EMA(shortPeriod);
    this.#shortAbsMomentum = new EMA(shortPeriod);
  }

  override getRequiredInputs() {
    return this.longPeriod + this.shortPeriod;
  }

  update(price: number, replace: boolean) {
    // A replacement measures momentum against the price before the replaced candle
    const previousPrice = replace ? this.#penultimatePrice : this.#previousPrice;

    if (!replace) {
      this.#penultimatePrice = this.#previousPrice;
    }

    this.#previousPrice = price;

    if (previousPrice === undefined) {
      return null;
    }

    const momentum = price - previousPrice;
    const smoothedMomentum = this.#longMomentum.update(momentum, replace);
    const smoothedAbsMomentum = this.#longAbsMomentum.update(Math.abs(momentum), replace);

    if (this.#longMomentum.isStable) {
      const doubleSmoothedMomentum = this.#shortMomentum.update(smoothedMomentum, replace);
      const doubleSmoothedAbsMomentum = this.#shortAbsMomentum.update(smoothedAbsMomentum, replace);

      if (this.#shortMomentum.isStable) {
        return this.setResult(
          doubleSmoothedAbsMomentum === 0 ? 0 : (100 * doubleSmoothedMomentum) / doubleSmoothedAbsMomentum,
          replace
        );
      }
    }

    return null;
  }
}
