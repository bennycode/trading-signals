import type {OpenHighLowClose} from '../../base/Candle.type.js';
import {IndicatorInputShape, ZeroCrossSeries} from '../../base/Indicator.js';

/**
 * Balance of Power (BOP)
 * Type: Momentum
 *
 * The Balance of Power (BOP), popularized by Igor Livshin, gauges which side controlled a single
 * candle by relating its body to its full range. A reading near +1 means buyers closed the candle
 * at the top of its range, a reading near -1 means sellers pinned the close to the bottom.
 *
 * This implementation is unsmoothed, matching Tulip Indicators. Chart platforms often display an
 * SMA-smoothed BOP, which can be composed by feeding these results into an SMA.
 *
 * Interpretation:
 * A BOP above zero signals bullish pressure, below zero bearish pressure. A doji closing where it
 * opened is perfectly balanced (zero), and a candle without any range carries no directional
 * information, so it also reads as balanced instead of dividing by zero.
 *
 * @see https://tulipindicators.org/bop
 * @see https://www.tradingview.com/support/solutions/43000589100-balance-of-power-bop/
 */
export class BOP extends ZeroCrossSeries<OpenHighLowClose> {
  override readonly inputShape = IndicatorInputShape.OPEN_HIGH_LOW_CLOSE;

  override getRequiredInputs() {
    return 1;
  }

  update({close, high, low, open}: OpenHighLowClose, replace: boolean) {
    const range = high - low;

    if (range <= 0) {
      return this.setResult(0, replace);
    }

    return this.setResult((close - open) / range, replace);
  }
}
