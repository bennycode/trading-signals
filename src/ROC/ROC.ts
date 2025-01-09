import type {BigSource} from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import Big from 'big.js';
import {pushUpdate} from '../util/pushUpdate.js';

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
  // TODO: Use "getFixedArray"
  public readonly prices: Big[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  update(price: BigSource, replace: boolean) {
    pushUpdate(this.prices, replace, price);

    /**
     * The priceHistory needs to have N prices in it before a result can be calculated with the following value. For
     * an interval of 5, the first result can be given on the 6th value.
     */
    if (this.prices.length > this.interval) {
      const comparePrice = this.prices.shift()!;

      return this.setResult(new Big(price).sub(comparePrice).div(comparePrice), replace);
    }

    return null;
  }
}

export class FasterROC extends NumberIndicatorSeries {
  public readonly prices: number[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  update(price: number, replace: boolean) {
    pushUpdate(this.prices, replace, price);

    if (this.prices.length > this.interval) {
      const comparePrice = this.prices.shift()!;

      return this.setResult((price - comparePrice) / comparePrice, replace);
    }

    return null;
  }
}
