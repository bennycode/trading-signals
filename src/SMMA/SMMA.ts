import Big, {BigSource} from 'big.js';
import {SMA} from '../';

class SMMA {
  private readonly interval: number;
  private result: Big;

  private readonly prices: Big[] = [];
  private readonly sma: SMA;

  constructor(interval: number) {
    this.interval = interval;
    this.sma = new SMA(interval);
    this.result = new Big(0);
  }

  update(price: BigSource): void {
    this.prices.push(new Big(price));

    if (this.prices.length < this.interval) {
      this.sma.update(price);
    } else if (this.prices.length === this.interval) {
      this.sma.update(price);
      this.result = this.sma.getResult();
    } else {
      this.result = this.result
        .times(this.interval - 1)
        .add(price)
        .div(this.interval);
    }
  }

  getResult(): Big {
    return this.result;
  }
}

export {SMMA};
