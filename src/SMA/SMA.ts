import Big, {BigSource} from 'big.js';
import {MovingAverage} from '../MA/MovingAverage';

/**
 * Simple Moving Average (SMA)
 * Type: Trend
 *
 * The Simple Moving Average (SMA) creates an average of all prices within a fixed interval. The SMA weights the prices of all periods equally which makes it not as responsive to recent prices as the EMA.
 *
 * @see https://www.investopedia.com/terms/s/sma.asp
 */
export class SMA extends MovingAverage {
  public readonly prices: Big[] = [];

  override update(price: BigSource): Big | void {
    this.prices.push(new Big(price));

    if (this.prices.length > this.interval) {
      this.prices.shift();
    }

    if (this.prices.length === this.interval) {
      const sum = this.prices.reduce((a, b) => a.plus(b), new Big('0'));
      return this.setResult(sum.div(this.prices.length));
    }
  }
}
