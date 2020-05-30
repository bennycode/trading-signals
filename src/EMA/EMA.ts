import Big, {BigSource} from 'big.js';
import {MovingAverage} from '../MA/MovingAverage';

export class EMA extends MovingAverage {
  update(_price: BigSource): void {
    const price = new Big(_price);

    // If it's the first update there is no previous result and a default has to be set.
    if (!this.result) {
      this.result = price;
    }

    const weightFactor = 2 / (this.interval + 1);

    this.result = price.times(weightFactor).add(this.result.times(1 - weightFactor));
  }
}
