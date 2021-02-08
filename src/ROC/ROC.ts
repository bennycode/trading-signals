import Big, {BigSource} from 'big.js';
import {NotEnoughDataError} from '../error';

export class ROC {
  private readonly priceHistory: Big[] = [];
  private result: Big | undefined;

  constructor(public readonly interval: number) {
    this.interval = interval;
  }

  get isStable(): boolean {
    return this.result !== undefined;
  }

  update(_price: BigSource): void {
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
    this.result = price.sub(comparePrice).div(comparePrice);
  }

  getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }
}
