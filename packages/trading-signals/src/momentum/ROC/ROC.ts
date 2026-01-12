import {TrendIndicatorSeries, TradingSignal} from '../../types/Indicator.js';
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
    const comparePrice = this.prices.length === this.interval ? this.prices[0] : null;
    pushUpdate(this.prices, replace, price, this.interval);

    if (comparePrice !== null) {
      return this.setResult((price - comparePrice) / comparePrice, replace);
    }

    return null;
  }

  protected calculateSignalState(result: number | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isBearish = hasResult && result < 0;

    switch (true) {
      case !hasResult:
        return TradingSignal.UNKNOWN;
      case isBearish:
        return TradingSignal.BEARISH;
      default:
        return TradingSignal.BULLISH;
    }
  }
}
