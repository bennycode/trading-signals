import type {HighLowCloseVolume} from '../../base/Candle.type.js';
import {TradingSignal, TrendIndicatorSeries, type TradingSignals} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

type PVTState = {
  candles: HighLowCloseVolume[];
};

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
export class PVT extends TrendIndicatorSeries<HighLowCloseVolume, TradingSignals, PVTState> {
  protected override state: PVTState = {candles: []};

  override getRequiredInputs() {
    return 2;
  }

  update(candle: HighLowCloseVolume, replace: boolean) {
    this.trackState(replace);

    // trackState() already rewound the window on a replacement, so the candle is always appended
    pushUpdate({array: this.state.candles, item: candle, maxLength: 2, replace: false});

    if (this.state.candles.length < 2) {
      return null;
    }

    const previousClose = this.state.candles[0].close;
    /*
     * PVT accumulates onto the running total, so a replacement has to build on the total from
     * before the replaced candle. `this.result` still carries that candle's contribution until
     * `setResult()` unwinds it, which would count the bar twice.
     */
    const previousPVT = (replace ? this.previousResult : this.result) ?? 0;

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
