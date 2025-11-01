import {TechnicalIndicator} from '../../types/Indicator.js';
import type {HighLowClose} from '../../types/HighLowClose.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Williams %R (Williams Percent Range)
 * Type: Momentum
 *
 * The Williams %R indicator, developed by Larry Williams, is a momentum indicator that measures overbought
 * and oversold levels. It is similar to the Stochastic Oscillator but is plotted on an inverted scale,
 * ranging from 0 to -100. Readings from 0 to -20 are considered overbought, while readings from -80 to -100
 * are considered oversold.
 *
 * The Williams %R is arithmetically exactly equivalent to the %K stochastic oscillator, mirrored at the 0%-line.
 *
 * Formula: %R = (Highest High - Close) / (Highest High - Lowest Low) × -100
 *
 * @see https://en.wikipedia.org/wiki/Williams_%25R
 * @see https://www.investopedia.com/terms/w/williamsr.asp
 */
export class WilliamsR extends TechnicalIndicator<number, HighLowClose<number>> {
  public readonly candles: HighLowClose<number>[] = [];

  /**
   * @param period The lookback period (typically 14)
   */
  constructor(public readonly period: number) {
    super();
  }

  override getRequiredInputs() {
    return this.period;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    pushUpdate(this.candles, replace, candle, this.period);

    if (this.candles.length === this.period) {
      const highest = Math.max(...this.candles.map(candle => candle.high));
      const lowest = Math.min(...this.candles.map(candle => candle.low));
      const divisor = highest - lowest;

      // Prevent division by zero
      if (divisor === 0) {
        return (this.result = -100);
      }

      const willR = ((highest - candle.close) / divisor) * -100;
      return (this.result = willR);
    }

    return null;
  }
}
