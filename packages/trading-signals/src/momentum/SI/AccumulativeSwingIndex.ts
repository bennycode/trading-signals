import type {OpenHighLowClose} from '../../base/Candle.type.js';
import {IndicatorInputShape, IndicatorSeries} from '../../base/Indicator.js';
import {SwingIndex} from './SwingIndex.js';

type AccumulativeSwingIndexState = {
  runningTotal: number;
};

/**
 * Accumulative Swing Index (ASI)
 * Type: Momentum
 *
 * Published by J. Welles Wilder in "New Concepts in Technical Trading Systems" (1978), the Accumulative Swing
 * Index keeps a running total of the Swing Index. Where a single Swing Index reading scores one bar-to-bar move,
 * the accumulated line filters that noise into a "synthetic price chart" that only advances when candles show
 * genuine swing strength.
 *
 * Interpretation:
 * Wilder reads the ASI exactly like price itself: trendlines and swing points drawn on the index line. When a
 * trendline on the ASI breaks together with a trendline on price, the breakout is confirmed; when price breaks out
 * but the ASI does not, the breakout is suspect. That reading requires drawn swing lines rather than a fixed
 * threshold, so this class emits no standalone signal.
 *
 * @see https://archive.org/details/newconceptsintec00wild
 * @see https://www.investopedia.com/terms/a/asi.asp
 * @see https://www.metatrader5.com/en/terminal/help/indicators/bw_indicators/asi
 */
export class AccumulativeSwingIndex extends IndicatorSeries<OpenHighLowClose, AccumulativeSwingIndexState> {
  override readonly inputShape = IndicatorInputShape.OPEN_HIGH_LOW_CLOSE;

  protected override state: AccumulativeSwingIndexState = {runningTotal: 0};
  readonly #swingIndex: SwingIndex;

  constructor(limitMove: number = 300) {
    super();
    this.#swingIndex = new SwingIndex(limitMove);
  }

  override getRequiredInputs() {
    return this.#swingIndex.getRequiredInputs();
  }

  update(candle: OpenHighLowClose, replace: boolean) {
    /*
     * The ASI accumulates every swing onto a running total, so a replacement has to build on the
     * total from before the replaced candle.
     */
    this.trackState(replace);

    const swingIndex = this.#swingIndex.update(candle, replace);

    if (swingIndex === null) {
      return null;
    }

    this.state.runningTotal += swingIndex;

    return this.setResult(this.state.runningTotal, replace);
  }
}
