import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator';
import {FasterRSI, RSI} from '../RSI/RSI';
import Big, {BigSource} from 'big.js';
import {FasterPeriod, Period} from '../util/Period';
import {FasterMovingAverageTypes, MovingAverageTypes} from '../MA/MovingAverageTypes';
import {FasterWSMA, WSMA} from '../WSMA/WSMA';

/**
 * Stochastic RSI (STOCHRSI)
 * Type: Momentum
 *
 * The Stochastic RSI is an oscillator ranging from 0 to 1 and was developed by Tushar S. Chande and Stanley Kroll.
 * Compared to the RSI, the Stochastic RSI is much steeper and often resides at the extremes (0 or 1). It can be used
 * to identify short-term trends.
 *
 * - A return value of 0.2 or below indicates an oversold condition
 * - A return value of 0.8 or above indicates an overbought condition
 * - Overbought doesn't mean that the price will reverse lower but it shows that the RSI reached an extreme
 * - Oversold doesn't mean that the price will reverse higher but it shows that the RSI reached an extreme
 *
 * @see https://www.investopedia.com/terms/s/stochrsi.asp
 */
export class StochasticRSI extends BigIndicatorSeries {
  private readonly period: Period;
  private readonly rsi: RSI;

  constructor(public readonly interval: number, SmoothingIndicator: MovingAverageTypes = WSMA) {
    super();
    this.period = new Period(interval);
    this.rsi = new RSI(interval, SmoothingIndicator);
  }

  override update(price: BigSource): void | Big {
    const rsiResult = this.rsi.update(price);
    if (rsiResult) {
      const periodResult = this.period.update(rsiResult);
      if (periodResult) {
        const min = periodResult.lowest;
        const max = periodResult.highest;
        const denominator = max.minus(min);
        // Prevent division by zero: https://github.com/bennycode/trading-signals/issues/378
        if (denominator.eq(0)) {
          return this.setResult(new Big(100));
        }
        const numerator = rsiResult.minus(min);
        return this.setResult(numerator.div(denominator));
      }
    }
  }
}

export class FasterStochasticRSI extends NumberIndicatorSeries {
  private readonly period: FasterPeriod;
  private readonly rsi: FasterRSI;

  constructor(public readonly interval: number, SmoothingIndicator: FasterMovingAverageTypes = FasterWSMA) {
    super();
    this.period = new FasterPeriod(interval);
    this.rsi = new FasterRSI(interval, SmoothingIndicator);
  }

  override update(price: number): void | number {
    const rsiResult = this.rsi.update(price);
    if (rsiResult !== undefined) {
      const periodResult = this.period.update(rsiResult);
      if (periodResult) {
        const min = periodResult.lowest;
        const max = periodResult.highest;
        const denominator = max - min;
        // Prevent division by zero: https://github.com/bennycode/trading-signals/issues/378
        if (denominator === 0) {
          return this.setResult(100);
        }
        const numerator = rsiResult - min;
        return this.setResult(numerator / denominator);
      }
    }
  }
}
