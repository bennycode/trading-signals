import type {BigSource} from 'big.js';
import Big from 'big.js';
import {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage.js';
import {pushUpdate} from '../util/pushUpdate.js';

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
  // TODO: Use "getFixedArray"
  public readonly prices: BigSource[] = [];

  constructor(public override readonly interval: number) {
    super(interval);
  }

  update(price: BigSource, replace: boolean) {
    pushUpdate(this.prices, replace, price);

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

    return null;
  }
}

export class FasterWMA extends FasterMovingAverage {
  public readonly prices: number[] = [];

  constructor(public override readonly interval: number) {
    super(interval);
  }

  update(price: number, replace: boolean) {
    pushUpdate(this.prices, replace, price);

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

    return null;
  }
}
