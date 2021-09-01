import Big, {BigSource} from 'big.js';
import {SMA} from '../';
import {MovingAverage} from '../MA/MovingAverage';

class SMMA extends MovingAverage {
  public readonly prices: Big[] = [];
  private readonly sma: SMA;

  constructor(public readonly interval: number) {
    super(interval);
    this.sma = new SMA(interval);
  }

  override update(price: BigSource): Big | void {
    this.prices.push(new Big(price));

    if (this.prices.length < this.interval) {
      this.sma.update(price);
    } else if (this.prices.length === this.interval) {
      this.sma.update(price);
      this.setResult(this.sma.getResult());
    } else {
      this.setResult(
        this.getResult()
          .times(this.interval - 1)
          .add(price)
          .div(this.interval)
      );
    }

    if (this.prices.length > this.interval) {
      this.prices.shift();
    }

    return this.result;
  }

  override getResult(): Big {
    return this.result || new Big(0);
  }
}

export {SMMA};
