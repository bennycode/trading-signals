import {IndicatorSeries} from '../../base/Indicator.js';
import type {HilbertCycleState} from './HilbertTransform.js';
import {createHilbertCycleState, lag, measureDominantCycle, pushCapped} from './HilbertTransform.js';

type HTTrendlineState = HilbertCycleState & {
  barsTotal: number;
  cycleAverages: number[];
  prices: number[];
  smoothPeriod: number;
};

/**
 * Hilbert Transform Instantaneous Trendline (HT Trendline)
 * Type: Trend
 *
 * John Ehlers' Instantaneous Trendline ("Rocket Science for Traders", Wiley 2001) removes the
 * market's cycle component instead of merely damping it: a Hilbert transform with a homodyne
 * discriminator measures the dominant cycle length in-line, and averaging price over exactly one
 * full cycle cancels that oscillation out of the series. What remains is the trend, tracked with
 * less lag than a fixed-length moving average of comparable smoothness, because the averaging
 * window nulls the dominant swing rather than smearing it. A final 4-3-2-1 weighting over the
 * last four cycle averages — the same weighting Ehlers applies to raw price before the cycle
 * measurement — polishes off the residual stair-stepping of the whole-bar window.
 *
 * @see https://www.mesasoftware.com/papers/MAMA.pdf
 * @see https://github.com/TA-Lib/ta-lib/blob/main/src/ta_func/ta_HT_TRENDLINE.c
 */
export class HTTrendline extends IndicatorSeries<number, HTTrendlineState> {
  protected override state: HTTrendlineState = {
    ...createHilbertCycleState(),
    barsTotal: 0,
    cycleAverages: [],
    prices: [],
    smoothPeriod: 0,
  };

  /**
   * Mirrors the TA-Lib lookback of 63 bars plus the emitting bar: 31 bars are skipped for
   * compatibility with the TradeStation implementation in Ehlers' book, and 32 more cover the
   * cycle measurement's warm-up, identical to MAMA's lookback. The recursive averages inside
   * keep settling after the first emission, exactly as TA-Lib emits them with its default
   * unstable period of zero.
   */
  override getRequiredInputs() {
    return 64;
  }

  update(price: number, replace: boolean) {
    this.trackState(replace);

    const state = this.state;
    state.barsTotal++;

    // The averaging window can span up to the 50-bar cap of the cycle measurement
    pushCapped(state.prices, price, 50);

    /*
     * The reference implementation spends the first 37 bars solely on sliding its price smoother
     * into place; engaging the cycle measurement on the same bar keeps every emission aligned
     * bar-for-bar with TA-Lib.
     */
    if (state.barsTotal <= 37) {
      return null;
    }

    measureDominantCycle(state, state.prices);

    // A slower second smoothing steadies the period reading before it is rounded to whole bars
    state.smoothPeriod = 0.33 * state.period + 0.67 * state.smoothPeriod;

    const dominantCycleBars = Math.trunc(state.smoothPeriod + 0.5);

    let cycleAverage = 0;

    for (let bar = 0; bar < dominantCycleBars; bar++) {
      cycleAverage += lag(state.prices, bar);
    }

    /*
     * Averaging raw price over exactly one dominant cycle cancels the cycle component out of the
     * series. Ehlers averages price itself here — the smoothed series only feeds the cycle
     * measurement. Until the period reading has grown to a full bar, the average keeps its zero
     * seed.
     */
    if (dominantCycleBars > 0) {
      cycleAverage = cycleAverage / dominantCycleBars;
    }

    const trendline =
      (4 * cycleAverage +
        3 * lag(state.cycleAverages, 0) +
        2 * lag(state.cycleAverages, 1) +
        lag(state.cycleAverages, 2)) /
      10;
    pushCapped(state.cycleAverages, cycleAverage, 3);

    if (state.barsTotal < this.getRequiredInputs()) {
      return null;
    }

    return this.setResult(trendline, replace);
  }
}
