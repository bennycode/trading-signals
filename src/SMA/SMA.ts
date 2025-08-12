import {FasterMovingAverage} from '../MA/MovingAverage.js';
import {getFasterAverage} from '../util/getAverage.js';
import {pushUpdate} from '../util/pushUpdate.js';

/**
 * Simple Moving Average (SMA)
 * Type: Trend
 *
 * The Simple Moving Average (SMA) creates an average of all prices within a fixed interval. The SMA weights the prices
 * of all periods equally which makes it not as responsive to recent prices as the EMA.
 *
 * @see https://www.investopedia.com/terms/s/sma.asp
 */
export class FasterSMA extends FasterMovingAverage {
  public readonly prices: number[] = [];

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    pushUpdate(this.prices, replace, price, this.interval);

    if (this.prices.length === this.interval) {
      return this.setResult(getFasterAverage(this.prices), replace);
    }

    return null;
  }
}
