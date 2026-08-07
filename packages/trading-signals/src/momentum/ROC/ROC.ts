import {TrendIndicatorSeries, TradingSignal} from '../../base/Indicator.js';
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

  public readonly interval: number;

  constructor(interval: number) {
    super();
    this.interval = interval;
  }

  override getRequiredInputs() {
    // Comparing against the price `interval` bars back needs that bar on top of the interval itself.
    return this.interval + 1;
  }

  update(price: number, replace: boolean) {
    /*
     * Keeping the comparand inside the window makes `replace()` correct for free: the window is the
     * only state, so re-running the latest bar cannot read anything the previous bar left behind.
     */
    pushUpdate({array: this.prices, item: price, maxLength: this.getRequiredInputs(), replace: replace});

    if (this.prices.length === this.getRequiredInputs()) {
      const comparePrice = this.prices[0];
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
