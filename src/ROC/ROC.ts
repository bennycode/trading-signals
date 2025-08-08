import {NumberIndicatorSeries} from '../Indicator.js';
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
export class ROC extends NumberIndicatorSeries {
  public readonly prices: number[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    const comparePrice = pushUpdate(this.prices, replace, price, this.interval);

    /**
     * The priceHistory needs to have N prices in it before a result can be calculated with the following value. For
     * an interval of 5, the first result can be given on the 6th value.
     */
    if (comparePrice) {
      return this.setResult((price - comparePrice) / comparePrice, replace);
    }

    return null;
  }
}
