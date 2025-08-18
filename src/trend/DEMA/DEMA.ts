import {EMA} from '../EMA/EMA.js';
import {IndicatorSeries} from '../../types/Indicator.js';

/**
 * Double Exponential Moving Average (DEMA)
 * Type: Trend
 *
 * The Double Exponential Moving Average (DEMA) was developed by Patrick G. Mulloy. It attempts to remove the lag associated with Moving Averages by placing more weight on recent values. It has its name because the value of an EMA is doubled which makes it responds more quickly to short-term price changes than a normal EMA.
 *
 * @see https://www.investopedia.com/terms/d/double-exponential-moving-average.asp
 */
export class DEMA extends IndicatorSeries {
  private readonly inner: EMA;
  private readonly outer: EMA;

  constructor(public readonly interval: number) {
    super();
    this.inner = new EMA(interval);
    this.outer = new EMA(interval);
  }

  override getRequiredInputs() {
    return this.outer.getRequiredInputs();
  }

  update(price: number, replace: boolean): number {
    const innerResult = this.inner.update(price, replace);
    const outerResult = this.outer.update(innerResult, replace);
    return this.setResult(innerResult * 2 - outerResult, replace);
  }

  override get isStable(): boolean {
    return this.outer.isStable;
  }
}
