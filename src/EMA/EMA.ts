import Big, {BigSource} from 'big.js';
import {MovingAverage} from '../MA/MovingAverage';
import {NotEnoughDataError} from '../error';

export class EMA extends MovingAverage {
  private pricesCounter = 0;

  update(_price: BigSource): Big {
    this.pricesCounter++;
    const price = new Big(_price);

    // If it's the first update there is no previous result and a default has to be set.
    if (!this.result) {
      this.result = price;
    }

    const weightFactor = 2 / (this.interval + 1);

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
