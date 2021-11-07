import Big, {BigSource} from 'big.js';
import {NotEnoughDataError} from '../error';
import {BigIndicatorSeries} from '../Indicator';

/**
 * Rate Of Change Indicator (ROC)
 * Type: Momentum
 *
 * A positive Rate of Change (ROC) signals a high momentum and a positive trend. A decreasing ROC or even negative ROC indicates a downtrend.
 *
 * @see https://www.investopedia.com/terms/r/rateofchange.asp
 */
export class ROC extends BigIndicatorSeries {
  private readonly priceHistory: BigSource[] = [];

  constructor(public readonly interval: number) {
    super();
    this.interval = interval;
  }

  override get isStable(): boolean {
    return this.result !== undefined;
  }

  override update(price: BigSource): Big | void {
    this.priceHistory.push(price);
    if (this.priceHistory.length <= this.interval) {
      /**
       * The priceHistory needs to have N prices in it before a result can be calculated with the following value. For
       * an interval of 5, the first result can be given on the 6th value.
       */
      return;
    }

    /**
     * Take the price this.interval periods ago.
     */
    const comparePrice = this.priceHistory.shift() as Big;

    // (Close - Close <interval> periods ago) / (Close <interval> periods ago)
    return this.setResult(new Big(price).sub(comparePrice).div(comparePrice));
  }

  override getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }
}
