import type {OpenHighLowCloseVolume} from '../../types/HighLowClose.js';
import {TrendIndicatorSeries, TrendSignal} from '../../types/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

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

  constructor(public readonly interval: number) {
    super();
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(candle: OpenHighLowCloseVolume<number>, replace: boolean) {
    pushUpdate(this.candles, replace, candle, this.getRequiredInputs());

    if (this.candles.length < this.getRequiredInputs()) {
      return null;
    }

    const prevCandle = this.candles[this.candles.length - 2];
    const prevPrice = prevCandle.close;
    const prevResult = this.result ?? 0;
    const currentPrice = candle.close;
    const nextResult = currentPrice > prevPrice ? candle.volume : currentPrice < prevPrice ? -candle.volume : 0;

    return this.setResult(prevResult + nextResult, false);
  }

  protected calculateSignalState(result: number | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const previousResult = this.previousResult;
    const hasPreviousResult = previousResult !== undefined;
    const isBullish = hasResult && hasPreviousResult && result > previousResult;
    const isBearish = hasResult && hasPreviousResult && result < previousResult;

    switch (true) {
      case !hasResult:
        return TrendSignal.NA;
      case isBullish:
        return TrendSignal.BULLISH;
      case isBearish:
        return TrendSignal.BEARISH;
      default:
        return TrendSignal.UNKNOWN;
    }
  }
}
