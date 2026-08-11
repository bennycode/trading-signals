import {IndicatorSeries} from '../../base/Indicator.js';

type HTTrendlineState = {
  barsTotal: number;
  cycleAverages: number[];
  detrenders: number[];
  i2: number;
  im: number;
  period: number;
  prices: number[];
  q2: number;
  quadratures: number[];
  re: number;
  smoothed: number[];
  smoothPeriod: number;
};

/*
 * Transfer response coefficients of Ehlers' Hilbert transform approximation. Together with the
 * per-bar amplitude adjustment they keep the quadrature component's amplitude flat across the
 * cycle periods the transform is tuned for. The in-repo sibling MAMA measures the dominant
 * cycle with the same machinery.
 */
const HILBERT_A = 0.0962;
const HILBERT_B = 0.5769;

const RAD_TO_DEG = 180 / Math.PI;

const lag = (history: readonly number[], bars: number) => history.at(-1 - bars) ?? 0;

const pushCapped = (history: number[], value: number, maxLength: number) => {
  history.push(value);

  if (history.length > maxLength) {
    history.shift();
  }
};

/*
 * Ehlers' one-sided Hilbert transform: a 4-tap filter over every other bar that shifts the series
 * by 90 degrees. A series that has gone flat must cancel to an exact zero here — rounding dust
 * would masquerade as a phase reading — so the summation pairs the taps exactly like the TA-Lib
 * reference does.
 */
const hilbertTransform = (history: readonly number[], adjustment: number, delay: number = 0) => {
  const transformed =
    HILBERT_A * lag(history, delay) -
    HILBERT_A * lag(history, delay + 6) -
    HILBERT_B * lag(history, delay + 4) +
    HILBERT_B * lag(history, delay + 2);

  return transformed * adjustment;
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
    barsTotal: 0,
    cycleAverages: [],
    detrenders: [],
    i2: 0,
    im: 0,
    period: 0,
    prices: [],
    q2: 0,
    quadratures: [],
    re: 0,
    smoothed: [],
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

    const adjustment = 0.075 * state.period + 0.54;

    const smoothed =
      (4 * lag(state.prices, 0) + 3 * lag(state.prices, 1) + 2 * lag(state.prices, 2) + lag(state.prices, 3)) / 10;
    pushCapped(state.smoothed, smoothed, 7);

    // Detrending exposes the cycle component by removing the trend the smoothed price rides on
    const detrender = hilbertTransform(state.smoothed, adjustment);
    pushCapped(state.detrenders, detrender, 10);

    // The transform leads by 90 degrees, so it yields the quadrature; delaying the detrender yields the in-phase part
    const q1 = hilbertTransform(state.detrenders, adjustment);
    const i1 = lag(state.detrenders, 3);

    // Advancing both components by 90 degrees allows averaging the phasor over adjacent bars
    const jI = hilbertTransform(state.detrenders, adjustment, 3);
    pushCapped(state.quadratures, q1, 7);
    const jQ = hilbertTransform(state.quadratures, adjustment);

    const previousI2 = state.i2;
    const previousQ2 = state.q2;
    state.i2 = 0.2 * (i1 - jQ) + 0.8 * previousI2;
    state.q2 = 0.2 * (q1 + jI) + 0.8 * previousQ2;

    /*
     * Homodyne discriminator: multiplying the analytic signal by its one-bar-old conjugate leaves
     * exactly the phase advanced during that bar, whose full turn is the dominant cycle period.
     */
    state.re = 0.8 * state.re + 0.2 * (state.i2 * previousI2 + state.q2 * previousQ2);
    state.im = 0.8 * state.im + 0.2 * (state.i2 * previousQ2 - state.q2 * previousI2);

    const previousPeriod = state.period;
    let period = previousPeriod;

    // A market without any cycle signal offers no angle to read, so the last measurement carries over
    if (state.im * state.re !== 0) {
      period = 360 / (Math.atan(state.im / state.re) * RAD_TO_DEG);
    }

    // The period estimate may neither jump more than 50% up or 33% down per bar, nor leave the 6-50 bar band
    if (period > 1.5 * previousPeriod) {
      period = 1.5 * previousPeriod;
    }

    if (period < 0.67 * previousPeriod) {
      period = 0.67 * previousPeriod;
    }

    if (period < 6) {
      period = 6;
    }

    if (period > 50) {
      period = 50;
    }

    state.period = 0.2 * period + 0.8 * previousPeriod;

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
