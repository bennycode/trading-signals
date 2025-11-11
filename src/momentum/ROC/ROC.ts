import {TrendIndicatorSeries, TrendSignal} from '../../types/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Rate Of Change Indicator (ROC)
 * Type: Momentum
 *
 * A positive Rate of Change (ROC) signals a high momentum and a positive trend. A decreasing ROC or even negative ROC
 * indicates a downtrend.
 *
 * @see https://www.investopedia.com/terms/r/rateofchange.asp
 */
export class ROC extends TrendIndicatorSeries {
  public readonly prices: number[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    const comparePrice = pushUpdate(this.prices, replace, price, this.interval);

    if (comparePrice) {
      return this.setResult((price - comparePrice) / comparePrice, replace);
    }

    return null;
  }

  protected calculateSignal(result: number | null | undefined) {
    if (!result) {
      return TrendSignal.UNKNOWN;
    }

    if (result < 0) {
      return TrendSignal.BEARISH;
    }

    return TrendSignal.BULLISH;
  }
}
