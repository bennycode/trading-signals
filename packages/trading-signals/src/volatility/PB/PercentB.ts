import {ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {BollingerBands} from '../BBANDS/BollingerBands.js';

export type PercentBConfig = {
  /** Distance of the bands from the moving average, in standard deviations of the window */
  deviationMultiplier?: number;
  /** Number of closes in the moving window that forms the bands */
  interval?: number;
  signalThresholds?: SignalThresholds;
};

/**
 * Bollinger Bands %B (PB)
 * Type: Volatility
 *
 * Developed by John A. Bollinger, %B condenses his Bollinger Bands into a single number that locates the
 * close within the bands: 1 means the close sits on the upper band, 0 on the lower band and 0.5 on the
 * middle band (the moving average). The reading is not clamped, so a close beyond the bands pushes %B
 * above 1 or below 0 — which is how band breakouts show up in the value.
 *
 * Interpretation:
 * A value of 1 or above indicates an overbought market with the price pressing above the upper band
 * (bullish pressure), and 0 or below an oversold market with the price pressing below the lower band
 * (bearish pressure); both thresholds can be customized via the constructor. A completely flat market
 * collapses the bands onto the average, which offers no trading range to locate the close in, so %B
 * reads neutral (0.5).
 *
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:bollinger_band_perce_b
 * @see https://www.tradingview.com/support/solutions/43000501971-bollinger-bands-b-b/
 */
export class PercentB extends ThresholdCrossSeries {
  readonly #bollingerBands: BollingerBands;

  constructor({
    deviationMultiplier = 2,
    interval = 20,
    signalThresholds: {overbought = 1, oversold = 0} = {},
  }: PercentBConfig = {}) {
    super({overbought, oversold});
    this.#bollingerBands = new BollingerBands(interval, deviationMultiplier);
  }

  override getRequiredInputs() {
    return this.#bollingerBands.getRequiredInputs();
  }

  update(close: number, replace: boolean) {
    const bands = this.#bollingerBands.update(close, replace);

    if (bands === null) {
      return null;
    }

    const range = bands.upper - bands.lower;

    // A completely flat market offers no trading range to locate the close in, so the reading is neutral
    if (range === 0) {
      return this.setResult(0.5, replace);
    }

    return this.setResult((close - bands.lower) / range, replace);
  }
}
