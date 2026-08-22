import type {HighLowClose} from '../../base/Candle.type.js';
import {IndicatorInputShape, IndicatorSeries} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

type TrueExtremes = {
  trueHigh: number;
  trueLow: number;
};

/**
 * Choppiness Index (CHOP)
 * Type: Volatility
 *
 * Developed by the Australian commodity trader E.W. Dreiss using ideas from chaos theory, the Choppiness
 * Index tells apart a trending market from one chopping sideways by comparing the ground price actually
 * covered (the sum of true ranges) with the span of the window, related on a logarithmic scale. A trend
 * crosses its span once, so path and span nearly coincide and the reading approaches 0. A choppy market
 * folds back over the same prices again and again, so the path dwarfs the span and the reading approaches
 * 100. Candle ranges and window extremes are both extended to the previous close: a gap moves price without
 * printing it inside a candle, and counting that ground in the path but not in the span would push readings
 * off the 0–100 scale.
 *
 * Interpretation:
 * Readings are commonly banded at the Fibonacci retracement levels: above 61.8 the market is consolidating
 * (choppy — trend-following entries are prone to whipsaws), below 38.2 a strong trend is underway. The
 * reading is direction-agnostic — a crash and a rally both read as trending — which is why this indicator
 * emits no trading signal; direction has to come from a trend-following companion.
 *
 * @see https://www.tradingview.com/support/solutions/43000501980-choppiness-index-chop/
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:choppiness_index
 */
export class CHOP extends IndicatorSeries<HighLowClose<number>> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW_CLOSE;

  readonly #window: TrueExtremes[] = [];
  #previousClose?: number;
  #twoPreviousClose?: number;

  public readonly interval: number;

  constructor(interval: number = 14) {
    super();

    // A one-bar window cannot normalize the path: the logarithm of 1 is zero, which would divide the reading by zero
    if (interval < 2) {
      throw new Error(`The interval has to be at least 2, but "${interval}" was given.`);
    }

    this.interval = interval;
  }

  override getRequiredInputs() {
    // The candle ahead of the window only contributes the closing price that the first true range extends to
    return this.interval + 1;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    if (replace) {
      this.#previousClose = this.#twoPreviousClose;
    }

    if (this.#previousClose === undefined) {
      this.#previousClose = candle.close;
      return null;
    }

    const trueHigh = Math.max(candle.high, this.#previousClose);
    const trueLow = Math.min(candle.low, this.#previousClose);

    this.#twoPreviousClose = this.#previousClose;
    this.#previousClose = candle.close;

    pushUpdate({array: this.#window, item: {trueHigh, trueLow}, maxLength: this.interval, replace});

    if (this.#window.length < this.interval) {
      return null;
    }

    // A single pass over the window keeps the hot path free of per-candle array allocations
    let trueRangeSum = 0;
    let highest = this.#window[0].trueHigh;
    let lowest = this.#window[0].trueLow;

    for (const {trueHigh, trueLow} of this.#window) {
      trueRangeSum += trueHigh - trueLow;
      highest = Math.max(highest, trueHigh);
      lowest = Math.min(lowest, trueLow);
    }

    const range = highest - lowest;

    /*
     * A dead-flat window is the one degenerate case: without a span there is no path either, because
     * consecutive rangeless candles can only collapse onto the same price. Shrinking a window of candles
     * centered on one price towards that state keeps the path pinned at the window length times the span,
     * so the limit reads 100 — price went nowhere, which is maximal choppiness.
     */
    if (range === 0) {
      return this.setResult(100, replace);
    }

    return this.setResult((100 * Math.log10(trueRangeSum / range)) / Math.log10(this.interval), replace);
  }
}
