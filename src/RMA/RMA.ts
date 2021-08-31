import Big, {BigSource} from 'big.js';
import {MovingAverage} from '../MA/MovingAverage';
import {NotEnoughDataError} from '../error';

/**
 * Welles Wilder's Moving Average: The calculation is similar to Exponential Moving Averages with the difference that a smoothing factor of 1/interval is being used which makes it respond more slowly to price changes.
 */
export class RMA extends MovingAverage {
  private pricesCounter = 0;

  update(_price: BigSource): Big {
    this.pricesCounter++;
    const price = new Big(_price);

    // If it's the first update there is no previous result and a default has to be set.
    if (!this.result) {
      this.result = price;
    }

    const weightFactor = 1 / this.interval;

    return this.setResult(price.times(weightFactor).add(this.result.times(1 - weightFactor)));
  }

  override getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    if (this.pricesCounter < this.interval) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  override get isStable(): boolean {
    try {
      this.getResult();
      return true;
    } catch {
      return false;
    }
  }
}
