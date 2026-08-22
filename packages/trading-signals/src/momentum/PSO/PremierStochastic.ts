import type {HighLowClose} from '../../base/Candle.type.js';
import {IndicatorInputShape, ZeroCrossSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {getMaximum} from '../../util/math/getMaximum.js';
import {getMinimum} from '../../util/math/getMinimum.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

export type PremierStochasticConfig = {
  /** Length of each smoothing pass; defaults to the square root of the stochastic interval (rounded), as derived in the original article */
  smoothInterval?: number;
  /** Number of candles forming the high/low range the close is located in */
  stochInterval?: number;
};

/**
 * Premier Stochastic Oscillator (PSO)
 * Type: Momentum
 *
 * Published by Lee Leibfarth in the August 2008 issue of Technical Analysis of Stocks & Commodities, the
 * Premier Stochastic Oscillator centers a fast stochastic %K around zero, calms it with a double EMA pass,
 * and runs the outcome through an exponential normalization that compresses every reading into the open
 * interval between -1 and +1. The smoothing strips the jitter that makes a raw short-period stochastic
 * hard to trade, while the normalization stretches readings near the extremes so tops and bottoms show up
 * as saturation instead of noise.
 *
 * Interpretation: The zero line separates the momentum sides — above zero bullish, below zero bearish.
 * Leibfarth's published bands read values beyond +0.9 as an overbought extreme and below -0.9 as an
 * oversold extreme, with a pullback through ±0.2 after such an extreme marking the actual reversal.
 *
 * @see https://traders.com/Documentation/FEEDbk_docs/2008/08/TradersTips/TradersTips.html
 * @see https://www.quantconnect.com/docs/v2/writing-algorithms/indicators/supported-indicators/premier-stochastic-oscillator
 */
export class PremierStochastic extends ZeroCrossSeries<HighLowClose<number>> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW_CLOSE;

  public readonly stochInterval: number;
  public readonly smoothInterval: number;
  readonly #candles: HighLowClose<number>[] = [];
  readonly #single: EMA;
  readonly #double: EMA;

  constructor({smoothInterval, stochInterval = 8}: PremierStochasticConfig = {}) {
    super();
    this.stochInterval = stochInterval;
    this.smoothInterval = smoothInterval ?? Math.round(Math.sqrt(stochInterval));
    this.#single = new EMA(this.smoothInterval);
    this.#double = new EMA(this.smoothInterval);
  }

  override getRequiredInputs() {
    return this.stochInterval + 2 * (this.smoothInterval - 1);
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.stochInterval, replace});

    if (this.#candles.length < this.stochInterval) {
      return null;
    }

    const highest = getMaximum(this.#candles.map(({high}) => high));
    const lowest = getMinimum(this.#candles.map(({low}) => low));
    /*
     * A window without any price range offers no position to locate the close in, so the reading
     * counts as the neutral middle instead of fabricating momentum from a division by zero.
     */
    const stochK = highest === lowest ? 50 : ((candle.close - lowest) / (highest - lowest)) * 100;
    /*
     * Scaling the centered %K to a tenth keeps the exponential normalization inside sensible bounds:
     * a close pinned to its range maps to ±5, which saturates near ±0.99 instead of hitting the poles.
     */
    const single = this.#single.update(0.1 * (stochK - 50), replace);

    if (this.#single.isStable) {
      const double = this.#double.update(single, replace);

      if (this.#double.isStable) {
        const stretched = Math.exp(double);
        return this.setResult((stretched - 1) / (stretched + 1), replace);
      }
    }

    return null;
  }
}
