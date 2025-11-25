import {MovingAverage} from '../MA/MovingAverage.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Spencer's 15-Point Moving Average
 * Type: Trend
 *
 * A specialized weighted moving average that uses 15 points with predefined weights
 * designed for optimal data smoothing. It’s a specific weighted moving average, designed to preserve the trend component in data while minimizing distortion from seasonal or irregular variations.
 *
 * The formula uses these specific weights:
 * [-3, -6, -5, 3, 21, 46, 67, 74, 67, 46, 21, 3, -5, -6, -3]
 *
 * @see https://www.stat.berkeley.edu/~aditya/Site/Statistics_153;_Spring_2012_files/Spring2012Statistics153LectureThree.pdf
 * @see https://mathworld.wolfram.com/Spencers15-PointMovingAverage.html
 */
export class SMA15 extends MovingAverage {
  public readonly prices: number[] = [];
  private static readonly WEIGHTS = [-3, -6, -5, 3, 21, 46, 67, 74, 67, 46, 21, 3, -5, -6, -3];
  private static readonly WEIGHT_SUM = 320;

  override getRequiredInputs() {
    return SMA15.WEIGHTS.length;
  }

  update(price: number, replace: boolean) {
    pushUpdate(this.prices, replace, price, this.getRequiredInputs());

    if (this.prices.length === this.getRequiredInputs()) {
      let weightedPricesSum = 0;

      for (let i = 0; i < this.getRequiredInputs(); i++) {
        const weightedPrice = this.prices[i] * SMA15.WEIGHTS[i];
        weightedPricesSum += weightedPrice;
      }

      const weightedAverage = weightedPricesSum / SMA15.WEIGHT_SUM;
      return this.setResult(weightedAverage, replace);
    }

    return null;
  }
}
