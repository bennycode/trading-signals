import type {HighLowCloseVolume} from '../../types/HighLowClose.js';
import {TradingSignal, TrendIndicatorSeries} from '../../types/Indicator.js';

/**
 * Accumulation/Distribution (AD)
 * Type: Volume
 *
 * The Accumulation/Distribution line is a cumulative volume-based indicator that measures the flow of money into or
 * out of a security. It uses the relationship between the close and the high-low range, weighted by volume, to
 * determine whether a security is being accumulated (bought) or distributed (sold).
 *
 * Formula:
 * Money Flow Multiplier = ((Close - Low) - (High - Close)) / (High - Low)
 * Money Flow Volume = Money Flow Multiplier * Volume
 * AD = Previous AD + Money Flow Volume
 *
 * @see https://www.investopedia.com/terms/a/accumulationdistribution.asp
 */
export class AD extends TrendIndicatorSeries<HighLowCloseVolume> {
  #previousCandle: HighLowCloseVolume | null = null;
  #previousAD: number | null = null;

  override getRequiredInputs() {
    return 1;
  }

  update(candle: HighLowCloseVolume, replace: boolean) {
    if (replace && this.#previousCandle !== null) {
      // Restore previous state when replacing
    } else {
      this.#previousAD = this.result ?? null;
    }

    this.#previousCandle = candle;

    const highLowDiff = candle.high - candle.low;

    let moneyFlowMultiplier = 0;

    if (highLowDiff !== 0) {
      moneyFlowMultiplier = (candle.close - candle.low - (candle.high - candle.close)) / highLowDiff;
    }

    const moneyFlowVolume = moneyFlowMultiplier * candle.volume;
    const ad = (this.#previousAD ?? 0) + moneyFlowVolume;

    return this.setResult(ad, replace);
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
