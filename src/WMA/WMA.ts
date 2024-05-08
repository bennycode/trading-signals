import {Big, type BigSource} from '../index.js';
import {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage.js';

/**
 * Weighted Moving Average (WMA)
 * Type: Trend
 *
 * Compared to SMA, the WMA puts more emphasis on the recent prices to reduce lag. Due to its responsiveness to price
 * changes, it rises faster and falls faster than the SMA when the price is inclining or declining.
 *
 * @see https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/weighted-moving-average-wma/
 */
export class WMA extends MovingAverage {
  public readonly prices: BigSource[] = [];

  constructor(public readonly interval: number) {
    super(interval);
  }

  override update(price: BigSource, replace: boolean = false): Big | void {
    if (this.prices.length && replace) {
      this.prices[this.prices.length - 1] = price;
    } else {
      this.prices.push(price);
    }

    if (this.prices.length > this.interval) {
      this.prices.shift();
    }

    if (this.prices.length === this.interval) {
      const weightedPricesSum = this.prices.reduce((acc: Big, price: BigSource, index: number) => {
        const weightedPrice = new Big(price).mul(index + 1);

        return acc.add(weightedPrice);
      }, new Big(0));

      const weightBase = (this.interval * (this.interval + 1)) / 2; // the numerator will always be even and the value will be an int.
      const weightedMa = weightedPricesSum.div(weightBase);

      return this.setResult(weightedMa, replace);
    }
  }
}

export class FasterWMA extends FasterMovingAverage {
  public readonly prices: number[] = [];

  constructor(public readonly interval: number) {
    super(interval);
  }

  override update(price: number, replace: boolean = false): number | void {
    if (this.prices.length && replace) {
      this.prices[this.prices.length - 1] = price;
    } else {
      this.prices.push(price);
    }

    if (this.prices.length > this.interval) {
      this.prices.shift();
    }

    if (this.prices.length === this.interval) {
      const weightedPricesSum = this.prices.reduce((acc: number, price: number, index: number) => {
        const weightedPrice = price * (index + 1);

        return acc + weightedPrice;
      }, 0);

      const weightBase = (this.interval * (this.interval + 1)) / 2; // the numerator will always be even and the value will be an int.

      const weightedMa = weightedPricesSum / weightBase;

      return this.setResult(weightedMa, replace);
    }
  }
}
