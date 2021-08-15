import Big, {BigSource} from 'big.js';
import {EMA, NotEnoughDataError} from '..';
import {SimpleIndicator} from '../Indicator';

export class DEMA extends SimpleIndicator {
  private readonly inner: EMA;
  private readonly outer: EMA;

  constructor(public readonly interval: number) {
    super();
    this.inner = new EMA(interval);
    this.outer = new EMA(interval);
  }

  update(price: BigSource): void {
    this.inner.update(price);
    this.outer.update(this.inner.getResult());
    this.setResult(this.inner.getResult().times(2).sub(this.outer.getResult()));
  }

  get isStable(): boolean {
    try {
      this.inner.getResult();
      this.outer.getResult();
      return true;
    } catch (error) {
      return false;
    }
  }

  getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }
}
