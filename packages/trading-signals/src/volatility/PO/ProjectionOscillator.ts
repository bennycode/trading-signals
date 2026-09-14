import type {HighLowClose} from '../../base/Candle.type.js';
import {IndicatorInputShape, ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

export type ProjectionOscillatorConfig = {
  /** Number of candles in the regression window that forms the projection bands */
  interval?: number;
  signalThresholds?: SignalThresholds;
};

/**
 * Projection Oscillator (PO)
 * Type: Volatility
 *
 * Developed by Mel Widner and published in "Technical Analysis of Stocks & Commodities" (July 1995), the
 * Projection Oscillator locates the latest close within its projection bands. A linear regression over the
 * closes of the window yields the current trend slope, every high and low in the window is projected forward
 * to the latest candle along that slope, and the band edges are the highest projected high and the lowest
 * projected low. Because the bands ride the trend, the oscillator reports strength relative to the trend
 * channel rather than a horizontal trading range: a steady climb reads as neutral, while only a close that
 * outruns its own regression channel reads as an extreme. It oscillates between 0 (close on the lower band)
 * and 100 (close on the upper band).
 *
 * Interpretation:
 * A value of 80 or above indicates an overbought condition and 20 or below an oversold condition (both
 * thresholds can be customized via the constructor). A completely flat window offers no trading range to
 * locate the close in, so the oscillator reads neutral (50).
 *
 * @see https://www.fmlabs.com/reference/default.htm?url=ProjectionOscillator.htm
 */
export class ProjectionOscillator extends ThresholdCrossSeries<HighLowClose<number>> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW_CLOSE;

  readonly #candles: HighLowClose<number>[] = [];
  public readonly interval: number;

  constructor({
    interval = 14,
    signalThresholds: {overbought = 80, oversold = 20} = {},
  }: ProjectionOscillatorConfig = {}) {
    super({overbought, oversold});

    // A regression slope needs at least two points; a single bar has no slope to project along
    if (interval < 2) {
      throw new Error(`The interval has to be at least 2, but "${interval}" was given.`);
    }

    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.interval, replace});

    if (this.#candles.length < this.interval) {
      return null;
    }

    const barCount = this.interval;
    const sumX = (barCount * (barCount - 1)) / 2;
    const sumXX = (barCount * (barCount - 1) * (2 * barCount - 1)) / 6;

    let sumY = 0;
    let sumXY = 0;

    this.#candles.forEach(({close}, x) => {
      sumY += close;
      sumXY += x * close;
    });

    const slope = (barCount * sumXY - sumX * sumY) / (barCount * sumXX - sumX * sumX);

    let upper = Number.NEGATIVE_INFINITY;
    let lower = Number.POSITIVE_INFINITY;

    this.#candles.forEach(({high, low}, x) => {
      const projection = slope * (barCount - 1 - x);
      upper = Math.max(upper, high + projection);
      lower = Math.min(lower, low + projection);
    });

    // A completely flat window offers no trading range to locate the close in, so the reading is neutral
    if (upper === lower) {
      return this.setResult(50, replace);
    }

    return this.setResult((100 * (candle.close - lower)) / (upper - lower), replace);
  }
}
