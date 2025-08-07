import {IndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import {getAverage, getFasterAverage, pushUpdate} from '../util/index.js';

/**
 * Mean Absolute Deviation (MAD)
 * Type: Volatility
 *
 * The mean absolute deviation (MAD) is calculating the absolute deviation / difference from the mean over a period.
 * Large outliers will reflect in a higher MAD.
 *
 * @see https://en.wikipedia.org/wiki/Average_absolute_deviation
 */
export class MAD extends NumberIndicatorSeries {
  public readonly prices: number[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    pushUpdate(this.prices, replace, price, this.interval);

    if (this.prices.length === this.interval) {
      const mean = getFasterAverage(this.prices);
      let sum = 0;
      for (let i = 0; i < this.interval; i++) {
        const deviation = Math.abs(this.prices[i] - mean);
        sum += deviation;
      }
      return this.setResult(sum / this.interval, replace);
    }

    return null;
  }

  static getResultFromBatch(prices: number[], average?: number): number {
    const mean = average || getFasterAverage(prices);
    let sum = 0;
    for (let i = 0; i < prices.length; i++) {
      const deviation = Math.abs(prices[i] - mean);
      sum += deviation;
    }
    return sum / prices.length;
  }
}
