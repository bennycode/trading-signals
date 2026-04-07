import type {HighLowCloseVolume} from '../../types/HighLowClose.js';
import {TradingSignal, TrendIndicatorSeries} from '../../types/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Price Volume Trend (PVT)
 * Type: Volume
 *
 * The Price Volume Trend (PVT) indicator is a cumulative volume-based indicator that adds or subtracts a percentage of
 * volume based on the relative change in closing prices. Unlike OBV, which adds or subtracts total volume, PVT adds
 * only a proportional amount of volume, making it more sensitive to price movements.
 *
 * Formula:
 * PVT = Previous PVT + (Volume * ((Close - Previous Close) / Previous Close))
 *
 * @see https://www.investopedia.com/terms/p/pvt.asp
 */
export class PVT extends TrendIndicatorSeries<HighLowCloseVolume> {
  readonly #candles: HighLowCloseVolume[] = [];

  override getRequiredInputs() {
    return 2;
  }

  update(candle: HighLowCloseVolume, replace: boolean) {
    pushUpdate(this.#candles, replace, candle, 2);

    if (this.#candles.length < 2) {
      return null;
    }

    const previousClose = this.#candles[0].close;
    const previousPVT = this.result ?? 0;

    if (previousClose === 0) {
      return this.setResult(previousPVT, replace);
    }

    const priceChangeRatio = (candle.close - previousClose) / previousClose;
    const pvt = previousPVT + candle.volume * priceChangeRatio;

    return this.setResult(pvt, replace);
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
