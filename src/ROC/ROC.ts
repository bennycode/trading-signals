import Big, {BigSource} from 'big.js';
import {NotEnoughDataError} from '../error';
import {SimpleIndicator} from '../Indicator';

export class ROC extends SimpleIndicator {
  private readonly priceHistory: Big[] = [];

  constructor(public readonly interval: number) {
    super();
    this.interval = interval;
  }

  override get isStable(): boolean {
    return this.result !== undefined;
  }

  override update(_price: BigSource): void {
    const price = new Big(_price);

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
    this.setResult(price.sub(comparePrice).div(comparePrice));
  }

  override getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }
}
