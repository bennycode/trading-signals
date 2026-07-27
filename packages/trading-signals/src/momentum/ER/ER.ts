import {TradingSignal, TrendIndicatorSeries} from '../../base/Indicator.js';
import type {HighLowClose} from '../../base/Candle.type.js';
import {getMaximum} from '../../util/getMaximum.js';
import {getMinimum} from '../../util/getMinimum.js';
import {pushUpdate} from '../../util/pushUpdate.js';

export type ERThresholds = {
  /** ER value at or above which the market counts as trending (default: 0.5) */
  trending?: number;
};

/**
 * Range Efficiency (ER)
 * Type: Momentum
 *
 * Measures how much of a price range was directional movement vs noise.
 * Returns a value between 0 and 1:
 * - Near 0: Choppy, range-bound (price oscillates without going anywhere)
 * - Near 1: Trending (most of the range is directional)
 *
 * Formula: |close_now - close_N_ago| / (highest_high - lowest_low)
 *
 * @see https://www.investopedia.com/terms/e/efficiencyratio.asp
 */
export class ER extends TrendIndicatorSeries<HighLowClose> {
  readonly #closes: number[] = [];
  readonly #highs: number[] = [];
  readonly #lows: number[] = [];

  public readonly interval: number;
  readonly #trending: number;

  constructor(interval: number, {trending = 0.5}: ERThresholds = {}) {
    super();
    this.interval = interval;
    this.#trending = trending;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(candle: HighLowClose, replace: boolean) {
    pushUpdate(this.#closes, replace, candle.close, this.interval);
    pushUpdate(this.#highs, replace, candle.high, this.interval);
    pushUpdate(this.#lows, replace, candle.low, this.interval);

    if (this.#closes.length < this.interval) {
      return null;
    }

    const netChange = Math.abs(this.#closes[this.#closes.length - 1] - this.#closes[0]);
    const highestHigh = getMaximum(this.#highs);
    const lowestLow = getMinimum(this.#lows);
    const range = highestHigh - lowestLow;

    if (range === 0) {
      return this.setResult(0, replace);
    }

    return this.setResult(netChange / range, replace);
  }

  protected calculateSignalState(result?: number | null | undefined) {
    if (result === null || result === undefined) {
      return TradingSignal.UNKNOWN;
    }

    if (result >= this.#trending) {
      return TradingSignal.BULLISH;
    }

    return TradingSignal.SIDEWAYS;
  }
}
