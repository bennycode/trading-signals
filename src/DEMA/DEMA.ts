import Big, {BigSource} from 'big.js';
import {EMA, NotEnoughDataError} from '..';
import {BigIndicatorSeries} from '../Indicator';

/**
 * Double Exponential Moving Average (DEMA)
 * Type: Trend
 *
 * The Double Exponential Moving Average (DEMA) was developed by Patrick G. Mulloy. It attempts to remove the lag
 * associated with Moving Averages by placing more weight on recent values. It has its name because the value of an EMA
 * is doubled which makes it responds more quickly to short-term price changes than a normal EMA.
 *
 * @see https://www.investopedia.com/terms/d/double-exponential-moving-average.asp
 */
export class DEMA extends BigIndicatorSeries {
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
