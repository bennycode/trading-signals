import type {OpenHighLowClose} from '../../types/HighLowClose.js';
import {TradingSignal, TrendIndicatorSeries} from '../../types/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Bullish Engulfing Pattern (BullishEngulfing)
 * Type: Pattern
 *
 * A two-candle reversal pattern: a bearish candle followed by a bullish candle whose real body
 * (the range between open and close, excluding wicks) strictly engulfs the previous real body.
 * It suggests that buyers overwhelmed sellers within a single bar, often marking the end of a
 * pullback.
 *
 * This implementation detects the pure candle shape and deliberately ignores trend context:
 * a bullish engulfing is only meaningful after a decline, so gate its signal with a trend
 * indicator (e.g. EMA, ADX) instead of relying on the pattern alone.
 *
 * Emits `1` when the pattern completes on the current candle and `0` otherwise.
 *
 * @see https://www.investopedia.com/terms/b/bullishengulfingpattern.asp
 */
export class BullishEngulfing extends TrendIndicatorSeries<OpenHighLowClose> {
  readonly #candles: OpenHighLowClose[] = [];

  override getRequiredInputs() {
    return 2;
  }

  update(candle: OpenHighLowClose, replace: boolean) {
    pushUpdate(this.#candles, replace, candle, this.getRequiredInputs());

    if (this.#candles.length < this.getRequiredInputs()) {
      return null;
    }

    const [previous, current] = this.#candles;
    const isPreviousBearish = previous.close < previous.open;
    const isCurrentBullish = current.close > current.open;
    const engulfsPreviousBody = current.open < previous.close && current.close > previous.open;
    const isEngulfing = isPreviousBearish && isCurrentBullish && engulfsPreviousBody;

    return this.setResult(isEngulfing ? 1 : 0, replace);
  }

  protected calculateSignalState(result?: number | null | undefined) {
    const hasResult = result !== null && result !== undefined;

    switch (true) {
      case !hasResult:
        return TradingSignal.UNKNOWN;
      case result === 1:
        return TradingSignal.BULLISH;
      default:
        return TradingSignal.SIDEWAYS;
    }
  }
}
