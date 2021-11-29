import {BigIndicatorSeries} from '../Indicator';
import {RSI} from '../RSI/RSI';
import Big, {BigSource} from 'big.js';
import {Period} from '../util/Period';
import {MovingAverageTypes} from '../MA/MovingAverageTypes';
import {WSMA} from '../WSMA/WSMA';

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
    const rsi = this.rsi.update(price);
    if (rsi) {
      this.period.update(rsi);
      if (this.period.isStable) {
        const min = this.period.lowest!;
        const max = this.period.highest!;
        const numerator = rsi.minus(min);
        const denominator = max.minus(min);
        return this.setResult(numerator.div(denominator));
      }
    }
  }
}
