import Big, {BigSource} from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator';

/**
 * Rate Of Change Indicator (ROC)
 * Type: Momentum
 *
 * A positive Rate of Change (ROC) signals a high momentum and a positive trend. A decreasing ROC or even negative ROC
 * indicates a downtrend.
 *
 * @see https://www.investopedia.com/terms/r/rateofchange.asp
 */
export class ROC extends BigIndicatorSeries {
  public readonly prices: Big[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override update(price: BigSource): Big | void {
    this.prices.push(new Big(price));

    /**
     * The priceHistory needs to have N prices in it before a result can be calculated with the following value. For
     * an interval of 5, the first result can be given on the 6th value.
     */
    if (this.prices.length > this.interval) {
      const comparePrice = this.prices.shift()!;

      return this.setResult(new Big(price).sub(comparePrice).div(comparePrice));
    }
  }
}

export class FasterROC extends NumberIndicatorSeries {
  public readonly prices: number[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override update(price: number): void | number {
    this.prices.push(price);

    if (this.prices.length > this.interval) {
      const comparePrice = this.prices.shift()!;

      return this.setResult((price - comparePrice) / comparePrice);
    }
  }
}
