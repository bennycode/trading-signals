import Big, {BigSource} from 'big.js';

export class ROC {
  private readonly interval: number;
  private readonly priceHistory: Big[] = [];
  private result: Big | undefined;

  constructor(interval: number) {
    this.interval = interval;
  }

  isStable(): boolean {
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
      throw Error('Not enough input data');
    }

    return this.result;
  }
}
