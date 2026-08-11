import {IndicatorSeries} from '../../base/Indicator.js';
import type {HighLowClose} from '../../base/Candle.type.js';
import {getTrueRange} from '../../util/getTrueRange.js';

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
  #previousCandle?: HighLowClose<number>;
  #twoPreviousCandle?: HighLowClose<number>;

  override getRequiredInputs() {
    return 1;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    if (this.#previousCandle && replace) {
      this.#previousCandle = this.#twoPreviousCandle;
    }

    const trueRange = getTrueRange(candle, this.#previousCandle?.close);

    this.#twoPreviousCandle = this.#previousCandle;
    this.#previousCandle = candle;

    return this.setResult(trueRange, replace);
  }
}
