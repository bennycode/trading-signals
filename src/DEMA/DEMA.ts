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

  override update(price: BigSource): Big {
    const innerResult = this.inner.update(price);
    const outerResult = this.outer.update(innerResult);
    return this.setResult(innerResult.times(2).sub(outerResult));
  }

  override get isStable(): boolean {
    try {
      this.inner.getResult();
      this.outer.getResult();
      return true;
    } catch {
      return false;
    }
  }

  override getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }
}
