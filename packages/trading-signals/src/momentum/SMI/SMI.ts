import type {HighLowClose} from '../../base/Candle.type.js';
import {ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {pushUpdate} from '../../util/pushUpdate.js';

export type SMIConfig = {
  /** Number of candles for the highest-high/lowest-low range (default: 10) */
  interval?: number;
  /** Number of candles for the first smoothing of the close's distance from the range midpoint (default: 3) */
  smooth1?: number;
  /** Number of candles for the second smoothing (default: 3) */
  smooth2?: number;
};

/**
 * Stochastic Momentum Index (SMI)
 * Type: Momentum
 *
 * The SMI was introduced by William Blau in the January 1993 issue of "Technical Analysis of Stocks & Commodities".
 * It refines the Stochastic Oscillator by locating the close relative to the midpoint of the recent high/low range
 * instead of relative to the range's low, so the sign alone tells which half of the range the market closes in.
 * Double-smoothing that distance with two EMAs and dividing by the equally smoothed half-range bounds the reading
 * between -100 and +100: at the extremes every close in memory pinned the top (or bottom) of its range.
 *
 * Interpretation: Blau reads +40 and above as an overbought market and -40 and below as an oversold market (both
 * thresholds can be customized via the constructor). The default configuration (10-candle range, two 3-candle
 * smoothings) follows the built-in SMI of charting platforms such as TradingView.
 *
 * A perfectly flat window has no range to locate the close in, so the indicator reports 0 instead of dividing zero
 * by zero.
 *
 * The EMAs seed with their first input (this library's convention). Implementations that seed differently (e.g.
 * Skender.Stock.Indicators) report different readings until the seeding transient has decayed.
 *
 * @see https://www.tradingview.com/support/solutions/43000707882-stochastic-momentum-index-smi/
 * @see https://www.fmlabs.com/reference/SMI.htm
 */
export class SMI extends ThresholdCrossSeries<HighLowClose<number>> {
  readonly #candles: HighLowClose<number>[] = [];
  readonly #smoothedDistance: EMA;
  readonly #smoothedRange: EMA;
  readonly #doubleSmoothedDistance: EMA;
  readonly #doubleSmoothedRange: EMA;

  public readonly interval: number;
  public readonly smooth1: number;
  public readonly smooth2: number;

  constructor(
    {interval = 10, smooth1 = 3, smooth2 = 3}: SMIConfig = {},
    {overbought = 40, oversold = -40}: SignalThresholds = {}
  ) {
    super({overbought, oversold});
    this.interval = interval;
    this.smooth1 = smooth1;
    this.smooth2 = smooth2;
    this.#smoothedDistance = new EMA(smooth1);
    this.#smoothedRange = new EMA(smooth1);
    this.#doubleSmoothedDistance = new EMA(smooth2);
    this.#doubleSmoothedRange = new EMA(smooth2);
  }

  override getRequiredInputs() {
    return this.interval + this.smooth1 + this.smooth2 - 2;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.interval, replace: replace});

    if (this.#candles.length < this.interval) {
      return null;
    }

    const highestHigh = Math.max(...this.#candles.map(candle => candle.high));
    const lowestLow = Math.min(...this.#candles.map(candle => candle.low));
    const distance = candle.close - (highestHigh + lowestLow) / 2;
    const range = highestHigh - lowestLow;

    const smoothedDistance = this.#smoothedDistance.update(distance, replace);
    const smoothedRange = this.#smoothedRange.update(range, replace);

    if (this.#smoothedDistance.isStable) {
      const doubleSmoothedDistance = this.#doubleSmoothedDistance.update(smoothedDistance, replace);
      const doubleSmoothedRange = this.#doubleSmoothedRange.update(smoothedRange, replace);

      if (this.#doubleSmoothedDistance.isStable) {
        const halfRange = doubleSmoothedRange / 2;

        return this.setResult(halfRange === 0 ? 0 : (100 * doubleSmoothedDistance) / halfRange, replace);
      }
    }

    return null;
  }
}
