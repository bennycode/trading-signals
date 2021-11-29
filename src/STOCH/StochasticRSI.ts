import {BigIndicatorSeries} from '../Indicator';
import {RSI} from '../RSI/RSI';
import Big, {BigSource} from 'big.js';
import {Period} from '../util/Period';
import {MovingAverageTypes} from '../MA/MovingAverageTypes';
import {WSMA} from '../WSMA/WSMA';

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
