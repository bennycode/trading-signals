import type {BigSource} from 'big.js';
import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import type {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage.js';
import type {FasterMovingAverageTypes, MovingAverageTypes} from '../MA/MovingAverageTypes.js';
import {FasterRSI, RSI} from '../RSI/RSI.js';
import {FasterSMA, SMA} from '../SMA/SMA.js';
import {FasterPeriod, Period} from '../util/Period.js';
import {FasterWSMA, WSMA} from '../WSMA/WSMA.js';

/**
 * Stochastic RSI (STOCHRSI)
 * Type: Momentum
 *
 * The Stochastic RSI is an oscillator ranging from 0 to 1 and was developed by Tushar S. Chande and Stanley Kroll.
 * Compared to the RSI, the Stochastic RSI is much steeper and often resides at the extremes (0 or 1). It can be used to identify short-term trends.
 *
 * - A return value of 0.2 or below indicates an oversold condition
 * - A return value around 0.5 indicates a neutral market
 * - A return value of 0.8 or above indicates an overbought condition
 * - Overbought doesn't mean that the price will reverse lower but it shows that the RSI reached an extreme
 * - Oversold doesn't mean that the price will reverse higher but it shows that the RSI reached an extreme
 *
 * The Stochastic RSI is often read through crossovers of its %K (fast) and %D (signal) lines. A %K crossing above %D in the oversold zone (below 20) may suggest a buy, while a %K crossing below %D in the overbought zone (above 80) can signal a potential sell.
 *
 * @see https://www.investopedia.com/terms/s/stochrsi.asp
 * @see https://lakshmishree.com/blog/stochastic-rsi-indicator/
 * @see https://alchemymarkets.com/education/indicators/stochastic-rsi/
 */
export class StochasticRSI extends BigIndicatorSeries {
  private readonly period: Period;
  private readonly rsi: RSI;

  constructor(
    public readonly interval: number,
    SmoothingRSI: MovingAverageTypes = WSMA,
    public readonly smoothing: {
      readonly k: MovingAverage;
      readonly d: MovingAverage;
    } = {
      d: new SMA(3),
      k: new SMA(3),
    }
  ) {
    super();
    this.period = new Period(interval);
    this.rsi = new RSI(interval, SmoothingRSI);
  }

  override getRequiredInputs() {
    return this.rsi.getRequiredInputs() + this.period.getRequiredInputs();
  }

  update(price: BigSource, replace: boolean) {
    const rsiResult = this.rsi.update(price, replace);
    if (rsiResult) {
      const periodResult = this.period.update(rsiResult, replace);
      if (periodResult) {
        const min = periodResult.lowest;
        const max = periodResult.highest;
        const denominator = max.minus(min);
        // Prevent division by zero: https://github.com/bennycode/trading-signals/issues/378
        if (denominator.eq(0)) {
          return this.setResult(new Big(100), replace);
        }
        const numerator = rsiResult.minus(min);
        const stochRSI = numerator.div(denominator);
        const k = this.smoothing.k.update(stochRSI, replace);
        if (k) {
          this.smoothing.d.update(k, replace);
        }
        return this.setResult(stochRSI, replace);
      }
    }

    return null;
  }
}

export class FasterStochasticRSI extends NumberIndicatorSeries {
  private readonly period: FasterPeriod;
  private readonly rsi: FasterRSI;

  constructor(
    public readonly interval: number,
    SmoothingRSI: FasterMovingAverageTypes = FasterWSMA,
    public readonly smoothing: {
      readonly k: FasterMovingAverage;
      readonly d: FasterMovingAverage;
    } = {
      d: new FasterSMA(3),
      k: new FasterSMA(3),
    }
  ) {
    super();
    this.period = new FasterPeriod(interval);
    this.rsi = new FasterRSI(interval, SmoothingRSI);
  }

  override getRequiredInputs() {
    return this.rsi.getRequiredInputs() + this.period.getRequiredInputs();
  }

  update(price: number, replace: boolean) {
    const rsiResult = this.rsi.update(price, replace);
    if (rsiResult) {
      const periodResult = this.period.update(rsiResult, replace);
      if (periodResult) {
        const min = periodResult.lowest;
        const max = periodResult.highest;
        const denominator = max - min;
        // Prevent division by zero: https://github.com/bennycode/trading-signals/issues/378
        if (denominator === 0) {
          return this.setResult(100, replace);
        }
        const numerator = rsiResult - min;
        const stochRSI = numerator / denominator;
        const k = this.smoothing.k.update(stochRSI, replace);
        if (k) {
          this.smoothing.d.update(k, replace);
        }
        return this.setResult(stochRSI, replace);
      }
    }

    return null;
  }
}
