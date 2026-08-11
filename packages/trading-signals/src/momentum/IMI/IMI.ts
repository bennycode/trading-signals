import type {OpenHighLowClose} from '../../base/Candle.type.js';
import {ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Intraday Momentum Index (IMI)
 * Type: Momentum
 *
 * Developed by Tushar Chande and Stanley Kroll ("The New Technical Trader", 1994), the Intraday
 * Momentum Index applies the RSI recipe to candle bodies: over the last candles it sums how much
 * up candles gained from open to close and how much down candles lost, then expresses the buying
 * share of that total as a value between 0 and 100. This exposes intraday conviction that
 * close-to-close oscillators miss — a market can gap higher day after day while sellers dominate
 * every session between open and close. Chande and Kroll suggest an interval of 14 periods.
 *
 * Interpretation:
 * A value of 70 or above indicates an overbought market, 30 or below an oversold market (both
 * thresholds can be customized via the constructor). A window of dojis closing exactly where
 * they opened exerts no intraday pressure in either direction, so the index reads neutral (50).
 *
 * @see https://www.investopedia.com/terms/i/intraday-momentum-index-imi.asp
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/imi
 */
export class IMI extends ThresholdCrossSeries<OpenHighLowClose> {
  readonly #candles: OpenHighLowClose[] = [];

  public readonly interval: number;

  constructor(interval: number = 14, {overbought = 70, oversold = 30}: SignalThresholds = {}) {
    super({overbought, oversold});

    // The candle window never fills nor caps without a real positive length
    if (!Number.isFinite(interval) || interval < 1) {
      throw new Error(`The interval has to be a positive number, but "${interval}" was given.`);
    }

    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(candle: OpenHighLowClose, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.interval, replace: replace});

    if (this.#candles.length < this.interval) {
      return null;
    }

    let gains = 0;
    let losses = 0;

    for (const {close, open} of this.#candles) {
      if (close > open) {
        gains += close - open;
      } else if (close < open) {
        losses += open - close;
      }
    }

    const totalPressure = gains + losses;

    // A window of dojis exerts no intraday pressure in either direction, so the index is neutral
    if (totalPressure === 0) {
      return this.setResult(50, replace);
    }

    return this.setResult((100 * gains) / totalPressure, replace);
  }
}
