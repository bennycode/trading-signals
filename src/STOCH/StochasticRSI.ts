import {BigIndicatorSeries} from '../Indicator';
import {RSI} from '../RSI/RSI';
import Big, {BigSource} from 'big.js';
import {Period} from '../util/Period';

export class StochasticRSI extends BigIndicatorSeries {
  private readonly rsi: RSI;
  private readonly period: Period;

  constructor(public readonly interval: number) {
    super();
    this.rsi = new RSI(interval);
    this.period = new Period(interval);
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
