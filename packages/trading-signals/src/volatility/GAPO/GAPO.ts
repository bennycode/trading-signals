import type {HighLow} from '../../base/Candle.type.js';
import {IndicatorSeries} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Gopalakrishnan Range Index (GAPO)
 * Type: Volatility
 *
 * Developed by Jayanthi Gopalakrishnan and published in "Technical Analysis of Stocks & Commodities"
 * (January 2000), the Gopalakrishnan Range Index reads range expansion and contraction on a logarithmic
 * scale: the trading range of the window (highest high minus lowest low) is related to the window length
 * by dividing the logarithm of the range by the logarithm of the interval. Because the reading is a ratio
 * of logarithms, any log base yields the same value.
 *
 * Interpretation:
 * A rising reading means the trading range is widening (growing volatility), a falling reading means it is
 * contracting (quiet market). Range expansion carries no directional information — a crash widens the range
 * just as a rally does — which is why this indicator emits no trading signal.
 *
 * @see https://www.fmlabs.com/reference/default.htm?url=GAPO.htm
 */
export class GAPO extends IndicatorSeries<HighLow> {
  readonly #candles: HighLow[] = [];
  public readonly interval: number;

  constructor(interval: number = 14) {
    super();

    // A one-bar window cannot normalize the range: the logarithm of 1 is zero, which would divide the reading by zero
    if (interval < 2) {
      throw new Error(`The interval has to be at least 2, but "${interval}" was given.`);
    }

    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(candle: HighLow, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.interval, replace});

    if (this.#candles.length < this.interval) {
      return null;
    }

    // A single pass over the window keeps the hot path free of per-candle array allocations
    let highest = this.#candles[0].high;
    let lowest = this.#candles[0].low;

    for (const {high, low} of this.#candles) {
      highest = Math.max(highest, high);
      lowest = Math.min(lowest, low);
    }

    const range = highest - lowest;

    // A rangeless window carries no range information to put on the log scale (its logarithm would read minus infinity)
    if (range === 0) {
      return this.setResult(0, replace);
    }

    return this.setResult(Math.log(range) / Math.log(this.interval), replace);
  }
}
