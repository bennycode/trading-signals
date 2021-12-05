import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator';
import {getMaximum, HighLowClose, HighLowCloseNumber} from '../util';

/**
 * True Range (TR)
 * Type: Volatility
 *
 * The True Range (TR) was developed by **John Welles Wilder, Jr.**. The range (R) is a candle's highest price minus
 * it's lowest price. The true range extends it to yesterday's closing price if it was outside of the current range.
 *
 * Low return values indicate a sideways trend with little volatility.
 *
 * @see https://www.linnsoft.com/techind/true-range-tr
 */
export class TR extends BigIndicatorSeries<HighLowClose> {
  private previousCandle?: HighLowClose;

  update(candle: HighLowClose): Big {
    const high = new Big(candle.high);
    const highLow = high.minus(candle.low);
    if (this.previousCandle) {
      const highClose = high.minus(this.previousCandle.close).abs();
      const lowClose = new Big(candle.low).minus(this.previousCandle.close).abs();
      this.previousCandle = candle;
      return this.setResult(getMaximum([highLow, highClose, lowClose]));
    }
    this.previousCandle = candle;
    return this.setResult(highLow);
  }
}

export class FasterTR extends NumberIndicatorSeries<HighLowCloseNumber> {
  private previousCandle?: HighLowCloseNumber;

  update(candle: HighLowCloseNumber): number {
    const {high, low} = candle;
    const highLow = high - low;
    if (this.previousCandle) {
      const highClose = Math.abs(high - this.previousCandle.close);
      const lowClose = Math.abs(low - this.previousCandle.close);
      this.previousCandle = candle;
      return this.setResult(Math.max(highLow, highClose, lowClose));
    }
    this.previousCandle = candle;
    return this.setResult(highLow);
  }
}
