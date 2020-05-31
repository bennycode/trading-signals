import Big, {BigSource} from 'big.js';
import {EMA} from '..';

export class DEMA {
  private result: Big | undefined;

  private readonly inner: EMA;
  private readonly outer: EMA;

  constructor(interval: number) {
    this.inner = new EMA(interval);
    this.outer = new EMA(interval);
  }

  update(price: BigSource): void {
    this.inner.update(price);
    this.outer.update(this.inner.getResult());

    this.result = this.inner.getResult().times(2).sub(this.outer.getResult());
  }

  getResult(): Big {
    if (!this.result) {
      throw Error('Not enough input data');
    }

    return this.result;
  }
}
