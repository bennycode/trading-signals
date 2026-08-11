import type {OpenHighLowCloseVolume} from '../../base/Candle.type.js';
import {TrendIndicatorSeries, TradingSignal} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

/**
 * On-Balance Volume (OBV)
 * Type: Momentum
 *
 * On-balance volume (OBV) is a technical trading momentum indicator that uses volume flow to predict changes in stock price. Joseph Granville first developed the OBV metric in the 1963 book Granville's New Key to Stock Market Profits.
 *
 * @see https://www.investopedia.com/terms/o/onbalancevolume.asp
 */
export class OBV extends TrendIndicatorSeries<OpenHighLowCloseVolume<number>> {
  public readonly candles: OpenHighLowCloseVolume<number>[] = [];

  public readonly interval: number;

  constructor(interval: number) {
    super();
    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(candle: OpenHighLowCloseVolume<number>, replace: boolean) {
    pushUpdate({array: this.candles, item: candle, maxLength: this.getRequiredInputs(), replace});

    if (this.candles.length < this.getRequiredInputs()) {
      return null;
    }

    const prevCandle = this.candles[this.candles.length - 2];
    const prevPrice = prevCandle.close;
    /*
     * OBV accumulates onto the running total, so a replacement has to build on the total from
     * before the replaced candle.
     */
    const prevResult = (replace ? this.previousResult : this.result) ?? 0;
    const currentPrice = candle.close;
    const nextResult = currentPrice > prevPrice ? candle.volume : currentPrice < prevPrice ? -candle.volume : 0;

    return this.setResult(prevResult + nextResult, replace);
  }

  protected calculateSignalState(result: number | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const previousResult = this.previousResult;
    const hasPreviousResult = previousResult !== undefined;
    const isBullish = hasResult && hasPreviousResult && result > previousResult;
    const isBearish = hasResult && hasPreviousResult && result < previousResult;

    switch (true) {
      case !hasResult:
        return TradingSignal.UNKNOWN;
      case isBullish:
        return TradingSignal.BULLISH;
      case isBearish:
        return TradingSignal.BEARISH;
      default:
        return TradingSignal.SIDEWAYS;
    }
  }
}
