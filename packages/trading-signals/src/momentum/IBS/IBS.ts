import type {HighLowClose} from '../../base/Candle.type.js';
import {ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';

/**
 * Internal Bar Strength (IBS)
 * Type: Momentum
 *
 * The Internal Bar Strength (IBS) locates the close within a single candle's range on a scale
 * from 0 to 1: a value of 1 means the candle closed at its high, 0 at its low. It is a
 * mean-reversion primitive popularized in the quant equity literature and shipped with
 * QuantConnect's LEAN engine: equity indices tend to bounce after closing near the bottom of
 * their daily range and to fade after closing near the top.
 *
 * Interpretation:
 * An IBS of 0.8 or above indicates an overbought condition (buyers pinned the close to the top
 * of the range), 0.2 or below indicates an oversold condition (both thresholds can be customized
 * via the constructor). A candle without any range gives the close no position to measure, so it
 * reads as the neutral midpoint instead of dividing by zero.
 *
 * @see https://github.com/QuantConnect/Lean/blob/master/Indicators/InternalBarStrength.cs
 * @see https://www.naaim.org/wp-content/uploads/2014/04/00V_Alexander_Pagonidis_The-IBS-Effect-Mean-Reversion-in-Equity-ETFs-1.pdf
 */
export class IBS extends ThresholdCrossSeries<HighLowClose<number>> {
  constructor({overbought = 0.8, oversold = 0.2}: SignalThresholds = {}) {
    super({overbought, oversold});
  }

  override getRequiredInputs() {
    return 1;
  }

  update({close, high, low}: HighLowClose<number>, replace: boolean) {
    const range = high - low;

    if (range <= 0) {
      return this.setResult(0.5, replace);
    }

    return this.setResult((close - low) / range, replace);
  }
}
