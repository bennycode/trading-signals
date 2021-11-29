import {Big, BigSource} from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator';
import {getAverage, getFasterAverage} from '../util';

/**
 * Mean Absolute Deviation (MAD)
 * Type: Volatility
 *
 * The mean absolute deviation (MAD) is calculating the absolute deviation / difference from the mean over a period.
 * Large outliers will reflect in a higher MAD.
 *
 * @see https://en.wikipedia.org/wiki/Average_absolute_deviation
 */
export class MAD extends BigIndicatorSeries {
  public readonly prices: BigSource[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override update(price: BigSource): void | Big {
    this.prices.push(price);

    if (this.prices.length > this.interval) {
      this.prices.shift();
    }

    if (this.prices.length === this.interval) {
      return this.setResult(MAD.getResultFromBatch(this.prices));
    }
  }

  static getResultFromBatch(prices: BigSource[], average?: BigSource): Big {
    const mean = average || getAverage(prices);
    let sum = new Big(0);
    for (let i = 0; i < prices.length; i++) {
      const deviation = new Big(prices[i]).minus(mean).abs();
      sum = sum.plus(deviation);
    }
    return sum.div(prices.length);
  }
}

export class FasterMAD extends NumberIndicatorSeries {
  public readonly prices: number[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override update(price: number): void | number {
    this.prices.push(price);

    if (this.prices.length > this.interval) {
      this.prices.shift();
    }

    if (this.prices.length === this.interval) {
      const mean = getFasterAverage(this.prices);
      let sum = 0;
      for (let i = 0; i < this.interval; i++) {
        const deviation = Math.abs(this.prices[i] - mean);
        sum += deviation;
      }
      return this.setResult(sum / this.interval);
    }
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
