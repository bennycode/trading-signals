import {IndicatorInputShape, ZeroCrossSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';

export type PVOConfig = {
  /** Number of candles for the fast EMA (default: 12) */
  fastPeriod?: number;
  /** Number of candles for the slow EMA (default: 26) */
  slowPeriod?: number;
};

/**
 * Percentage Volume Oscillator (PVO)
 * Type: Volume
 *
 * The PVO is the PPO applied to volume: it divides the spread between a fast and a slow EMA of volume by the slow
 * EMA. The percentage form makes volume thrust comparable across instruments — 20 million shares of extra activity
 * means nothing without knowing what is typical, while "volume runs 10% above its longer-term average" reads the
 * same everywhere. It consumes the plain volume stream of each candle, exactly as the PPO consumes a price stream.
 *
 * Interpretation: A reading above zero means volume is expanding — recent activity outpaces its longer-term
 * average, lending conviction to the current price move. A reading below zero means volume is drying up. A cross
 * of the zero line marks a volume regime change from contraction to expansion or back.
 *
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:percentage_volume_oscillator_pvo
 * @see https://www.investopedia.com/terms/p/ppo.asp
 */
export class PVO extends ZeroCrossSeries {
  override readonly inputShape = IndicatorInputShape.VOLUME;

  readonly #fast: EMA;
  readonly #slow: EMA;

  public readonly fastPeriod: number;
  public readonly slowPeriod: number;

  constructor({fastPeriod = 12, slowPeriod = 26}: PVOConfig = {}) {
    super();
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.#fast = new EMA(fastPeriod);
    this.#slow = new EMA(slowPeriod);
  }

  override getRequiredInputs() {
    return this.#slow.getRequiredInputs();
  }

  update(volume: number, replace: boolean) {
    const fast = this.#fast.update(volume, replace);
    const slow = this.#slow.update(volume, replace);

    if (!this.#slow.isStable) {
      return null;
    }

    /*
     * A halted market (nothing but zero volume so far) leaves no longer-term average to
     * compare against, so a neutral zero reading is reported instead of a division error.
     */
    if (slow === 0) {
      return this.setResult(0, replace);
    }

    return this.setResult((100 * (fast - slow)) / slow, replace);
  }
}
