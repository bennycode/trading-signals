import {IndicatorSeries} from '../../types/Indicator.js';
import type {HighLowClose} from '../../types/HighLowClose.js';

/**
 * True Range (TR)
 * Type: Volatility
 *
 * The True Range (TR) was developed by John Welles Wilder (Jr.). The range (R) is a candle's highest price minus it's lowest price. The true range extends it to yesterday's closing price if it was outside of the current range.
 *
 * Low return values indicate a sideways trend with little volatility.
 *
 * @see https://www.linnsoft.com/techind/true-range-tr
 */
export class TR extends IndicatorSeries<HighLowClose<number>> {
  private previousCandle?: HighLowClose<number>;
  private twoPreviousCandle?: HighLowClose<number>;

  override getRequiredInputs() {
    return 2;
  }

  update(candle: HighLowClose<number>, replace: boolean): number {
    const {high, low} = candle;
    const highLow = high - low;

    if (this.previousCandle && replace) {
      this.previousCandle = this.twoPreviousCandle;
    }

    if (this.previousCandle) {
      const highClose = Math.abs(high - this.previousCandle.close);
      const lowClose = Math.abs(low - this.previousCandle.close);
      this.twoPreviousCandle = this.previousCandle;
      this.previousCandle = candle;
      return this.setResult(Math.max(highLow, highClose, lowClose), replace);
    }
    this.twoPreviousCandle = this.previousCandle;
    this.previousCandle = candle;
    return this.setResult(highLow, replace);
  }
}
