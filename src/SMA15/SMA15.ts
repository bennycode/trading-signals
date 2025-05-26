import type {BigSource} from 'big.js';
import Big from 'big.js';
import {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage.js';
import {pushUpdate} from '../util/pushUpdate.js';

/**
 * Spencer's 15-Point Moving Average
 * Type: Trend
 *
 * A specialized weighted moving average that uses 15 points with predefined weights
 * designed for optimal data smoothing while preserving trend characteristics.
 *
 * The formula uses these specific weights:
 * [-3, -6, -5, 3, 21, 46, 67, 74, 67, 46, 21, 3, -5, -6, -3]
 *
 * @see https://www.stat.berkeley.edu/~aditya/Site/Statistics_153;_Spring_2012_files/Spring2012Statistics153LectureThree.pdf
 */
export class SMA15 extends MovingAverage {
  public readonly prices: BigSource[] = [];
  private static readonly WEIGHTS = [-3, -6, -5, 3, 21, 46, 67, 74, 67, 46, 21, 3, -5, -6, -3];
  private static readonly WEIGHT_SUM = 320;
  public static readonly INTERVAL = 15;

  constructor() {
    super(SMA15.INTERVAL);
  }

  update(price: BigSource, replace: boolean) {
    pushUpdate(this.prices, replace, price, SMA15.INTERVAL);

    if (this.prices.length === SMA15.INTERVAL) {
      let weightedPricesSum = new Big(0);

      // Apply weights to each price point
      for (let i = 0; i < SMA15.INTERVAL; i++) {
        const weightedPrice = new Big(this.prices[i]).mul(SMA15.WEIGHTS[i]);
        weightedPricesSum = weightedPricesSum.add(weightedPrice);
      }

      const weightedAverage = weightedPricesSum.div(SMA15.WEIGHT_SUM);
      return this.setResult(weightedAverage, replace);
    }

    return null;
  }
}

export class FasterSMA15 extends FasterMovingAverage {
  public readonly prices: number[] = [];
  private static readonly WEIGHTS = [-3, -6, -5, 3, 21, 46, 67, 74, 67, 46, 21, 3, -5, -6, -3];
  private static readonly WEIGHT_SUM = 320;
  public static readonly INTERVAL = 15;

  constructor() {
    super(FasterSMA15.INTERVAL);
  }

  update(price: number, replace: boolean) {
    pushUpdate(this.prices, replace, price, FasterSMA15.INTERVAL);

    if (this.prices.length === FasterSMA15.INTERVAL) {
      let weightedPricesSum = 0;

      // Apply weights to each price point
      for (let i = 0; i < FasterSMA15.INTERVAL; i++) {
        const weightedPrice = this.prices[i] * FasterSMA15.WEIGHTS[i];
        weightedPricesSum += weightedPrice;
      }

      const weightedAverage = weightedPricesSum / FasterSMA15.WEIGHT_SUM;
      return this.setResult(weightedAverage, replace);
    }

    return null;
  }
}