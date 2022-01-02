import {Indicator} from '../Indicator';
import Big from 'big.js';
import {FasterSMA, SMA} from '../SMA/SMA';
import {getMaximum} from '../util/getMaximum';
import {getMinimum} from '../util/getMinimum';
import {NotEnoughDataError} from '../error';
import {HighLowClose, HighLowCloseNumber} from '../util';

export interface StochasticResult {
  /** Slow stochastic indicator (%D) */
  stochD: Big;
  /** Fast stochastic indicator (%K) */
  stochK: Big;
}

export interface FasterStochasticResult {
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
 */
export class StochasticOscillator implements Indicator<StochasticResult, HighLowClose> {
  private readonly periodM: SMA;
  private readonly periodP: SMA;

  private readonly candles: HighLowClose[] = [];
  private result?: StochasticResult;

  /**
   * Constructs a Stochastic Oscillator.
   *
   * @param n The %k period
   * @param m The %k slowing period
   * @param p The %d period
   */
  constructor(public readonly n: number, public readonly m: number, public readonly p: number) {
    this.periodM = new SMA(m);
    this.periodP = new SMA(p);
  }

  getResult(): StochasticResult {
    if (this.result === undefined) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  update(candle: HighLowClose): void | StochasticResult {
    this.candles.push(candle);

    if (this.candles.length > this.n) {
      this.candles.shift();
    }

    if (this.candles.length === this.n) {
      const highest = getMaximum(this.candles.map(candle => candle.high));
      const lowest = getMinimum(this.candles.map(candle => candle.low));
      const divisor = new Big(highest).minus(lowest);
      let fastK = new Big(100).mul(new Big(candle.close).minus(lowest));
      // Prevent division by zero
      fastK = fastK.div(divisor.eq(0) ? 1 : divisor);
      const stochK = this.periodM.update(fastK); // (stoch_k, %k)
      const stochD = stochK && this.periodP.update(stochK); // (stoch_d, %d)
      if (stochK && stochD) {
        return (this.result = {
          stochD,
          stochK,
        });
      }
    }
  }

  get isStable(): boolean {
    return this.result !== undefined;
  }
}

export class FasterStochasticOscillator implements Indicator<FasterStochasticResult, HighLowCloseNumber> {
  public readonly candles: HighLowCloseNumber[] = [];
  private result: FasterStochasticResult | undefined;
  private readonly periodM: FasterSMA;
  private readonly periodP: FasterSMA;

  /**
   * @param n The %k period
   * @param m The %k slowing period
   * @param p The %d period
   */
  constructor(public n: number, public m: number, public p: number) {
    this.periodM = new FasterSMA(m);
    this.periodP = new FasterSMA(p);
  }

  getResult(): FasterStochasticResult {
    if (this.result === undefined) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  get isStable(): boolean {
    return this.result !== undefined;
  }

  update(candle: HighLowCloseNumber): void | FasterStochasticResult {
    this.candles.push(candle);

    if (this.candles.length > this.n) {
      this.candles.shift();
    }

    if (this.candles.length === this.n) {
      const highest = Math.max(...this.candles.map(candle => candle.high));
      const lowest = Math.min(...this.candles.map(candle => candle.low));
      const divisor = highest - lowest;
      let fastK = (candle.close - lowest) * 100;
      // Prevent division by zero
      fastK = fastK / (divisor === 0 ? 1 : divisor);
      const stochK = this.periodM.update(fastK); // (stoch_k, %k)
      const stochD = stochK && this.periodP.update(stochK); // (stoch_d, %d)
      if (stochK !== undefined && stochD !== undefined) {
        return (this.result = {
          stochD,
          stochK,
        });
      }
    }
  }
}
