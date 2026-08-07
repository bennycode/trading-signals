import type {HighLowClose} from '../../base/Candle.type.js';
import {TechnicalIndicator, TradingSignal} from '../../base/Indicator.js';
import {ATR} from '../../volatility/ATR/ATR.js';

export type VolatilityStopResult = {
  /**
   * Which side of the price the stop currently sits on. At the exact flip bar the stop value alone is ambiguous, so
   * the side is reported explicitly: BULLISH = stop below price (support), BEARISH = stop above price (resistance).
   */
  signal: typeof TradingSignal.BULLISH | typeof TradingSignal.BEARISH;
  /** Trailing stop level */
  stop: number;
};

export type VolatilityStopConfig = {
  /** Number of candles for the ATR (default: 5) */
  interval?: number;
  /** How many ATRs the stop trails behind the close (default: 3.5) */
  multiplier?: number;
};

/**
 * Volatility Stop (VSTOP)
 * Type: Trend
 *
 * Published by Sylvain Vervoort as "Average True Range Trailing Stops" (Technical Analysis of Stocks & Commodities,
 * June 2009). It trails a stop a multiple of the Average True Range behind the closing price, so the stop only
 * ratchets in the trade's favor: it rises (never falls) below price in an uptrend and falls (never rises) above
 * price in a downtrend. Because the distance adapts to volatility, a whippy market gets more room before the stop is
 * hit, while a quiet market keeps the stop tight.
 *
 * Interpretation:
 * A close beyond the stop flips it to the other side of the price — the stop switches from acting as support to
 * acting as resistance (or back), signaling a trend change rather than mere noise.
 *
 * @see https://traders.com/Documentation/FEEDbk_docs/2009/06/Vervoort.html
 * @see https://traders.com/Documentation/FEEDbk_docs/2009/06/TradersTips.html
 * @see https://toslc.thinkorswim.com/center/reference/Tech-Indicators/studies-library/A-B/ATRTrailingStop
 */
export class VolatilityStop extends TechnicalIndicator<VolatilityStopResult, HighLowClose<number>> {
  readonly #atr: ATR;
  #previous: {close: number; stop: number} | null = null;
  #previousSnapshot: {close: number; stop: number} | null = null;

  public readonly interval: number;
  public readonly multiplier: number;

  constructor({interval = 5, multiplier = 3.5}: VolatilityStopConfig = {}) {
    super();
    this.interval = interval;
    this.multiplier = multiplier;
    this.#atr = new ATR(interval);
  }

  override getRequiredInputs() {
    return this.#atr.getRequiredInputs();
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    if (replace) {
      this.#previous = this.#previousSnapshot;
    } else {
      this.#previousSnapshot = this.#previous;
    }

    const atr = this.#atr.update(candle, replace);

    if (atr === null) {
      return null;
    }

    const {close} = candle;
    const loss = this.multiplier * atr;
    const previous = this.#previous;

    let result: VolatilityStopResult;

    /*
     * Vervoort's published logic: while both the current and the previous close stay on the trend's side of the
     * stop, the stop only ratchets in the trend's direction; a close on the other side flips the stop over. The
     * first stable bar starts as an uptrend stop, matching the original MetaStock formula where PREV starts at 0.
     */
    if (previous === null) {
      result = {signal: TradingSignal.BULLISH, stop: close - loss};
    } else if (close > previous.stop && previous.close > previous.stop) {
      result = {signal: TradingSignal.BULLISH, stop: Math.max(previous.stop, close - loss)};
    } else if (close < previous.stop && previous.close < previous.stop) {
      result = {signal: TradingSignal.BEARISH, stop: Math.min(previous.stop, close + loss)};
    } else if (close > previous.stop) {
      result = {signal: TradingSignal.BULLISH, stop: close - loss};
    } else {
      result = {signal: TradingSignal.BEARISH, stop: close + loss};
    }

    this.#previous = {close, stop: result.stop};

    return (this.result = result);
  }
}
