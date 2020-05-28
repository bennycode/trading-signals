import Big from 'big.js';
import {MovingAverage} from '../MA/MovingAverage';

export class SMA extends MovingAverage {
  private readonly prices: Big[] = [];

  update(price: Big): void {
    this.prices.push(price);

    if (this.prices.length > this.interval) {
      this.prices.shift();
    }

    if (this.prices.length === this.interval) {
      const sum = this.prices.reduce((a, b) => a.plus(b), new Big('0'));
      this.result = sum.div(this.prices.length);
    }
  }
}
