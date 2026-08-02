import {IndicatorSeries} from '../../base/Indicator.js';
import type {HighLowClose} from '../../base/Candle.type.js';
import {getTypicalPrice} from '../../util/getTypicalPrice.js';

/**
 * Typical Price (TYPPRICE)
 * Type: Trend
 *
 * Collapses a candle's high, low and close into the single price most of that bar's trading actually happened
 * around. A close alone ignores where price travelled during the bar, so an indicator fed only closes treats a
 * quiet bar and a violent reversal that closed flat as identical. Averaging the three keeps the bar's range in
 * the number, which is why it is the input to Commodity Channel Index (CCI), Money Flow Index (MFI) and Volume
 * Weighted Average Price (VWAP) rather than the raw close.
 *
 * @see https://tulipindicators.org/typprice
 */
export class TypicalPrice extends IndicatorSeries<HighLowClose<number>> {
  override getRequiredInputs() {
    return 1;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    return this.setResult(getTypicalPrice(candle), replace);
  }
}
