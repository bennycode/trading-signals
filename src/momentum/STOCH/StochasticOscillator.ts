import {TechnicalIndicator} from '../../types/Indicator.js';
import {SMA} from '../../trend/SMA/SMA.js';
import type {HighLowClose} from '../../types/HighLowClose.js';
import {pushUpdate} from '../../util/pushUpdate.js';

export interface StochasticResult {
  /** Slow stochastic indicator (%D) */
  stochD: number;
  /** Fast stochastic indicator (%K) */
  stochK: number;
}

/**
 * Stochastic Oscillator (STOCH)
 * Type: Momentum
 *
 * The Stochastic Oscillator was developed by George Lane and is range-bound between 0 and 100. The Stochastic
 * Oscillator attempts to predict price turning points. A value of 80 indicates that the asset is on the verge of being
 * overbought. By default, a Simple Moving Average (SMA) is used. When the momentum starts to slow down, the Stochastic
 * Oscillator values start to turn down. In the case of an uptrend, prices tend to make higher highs, and the
 * settlement price usually tends to be in the upper end of that time period's trading range.
 *
 * The stochastic k (%k) values represent the relation between current close to the period's price range (high/low). It
 * is sometimes referred as the "fast" stochastic period (fastk). The stochastic d (%d) values represent a Moving
 * Average of the %k values. It is sometimes referred as the "slow" period.
 *
 * @see https://en.wikipedia.org/wiki/Stochastic_oscillator
 * @see https://www.investopedia.com/terms/s/stochasticoscillator.asp
 * @see https://tulipindicators.org/stoch
 */
export class StochasticOscillator extends TechnicalIndicator<StochasticResult, HighLowClose<number>> {
  public readonly candles: HighLowClose<number>[] = [];
  private readonly periodM: SMA;
  private readonly periodP: SMA;

  /**
   * @param n The %k period
   * @param m The %k slowing period
   * @param p The %d period
   */
  constructor(
    public n: number,
    public m: number,
    public p: number
  ) {
    super();
    this.periodM = new SMA(m);
    this.periodP = new SMA(p);
  }

  override getRequiredInputs() {
    return this.n + this.p + 1;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    pushUpdate(this.candles, replace, candle, this.n);

    if (this.candles.length === this.n) {
      const highest = Math.max(...this.candles.map(candle => candle.high));
      const lowest = Math.min(...this.candles.map(candle => candle.low));
      const divisor = highest - lowest;
      let fastK = (candle.close - lowest) * 100;
      // Prevent division by zero
      fastK = fastK / (divisor === 0 ? 1 : divisor);
      const stochK = this.periodM.update(fastK, replace); // (stoch_k, %k)
      const stochD = stochK && this.periodP.update(stochK, replace); // (stoch_d, %d)

      if (stochK !== null && stochD !== null) {
        return (this.result = {
          stochD,
          stochK,
        });
      }
    }

    return null;
  }
}
