import {TechnicalIndicator, TradingSignal} from '../../base/Indicator.js';

export type MAMAConfig = {
  /** Upper bound of the adaptive smoothing factor, in effect while price is trending (default: 0.5) */
  fastLimit?: number;
  /** Lower bound of the adaptive smoothing factor, in effect while price is cycling sideways (default: 0.05) */
  slowLimit?: number;
};

export type MAMAResult = {
  /** Following Adaptive Moving Average: trails the MAMA line at half its speed and acts as its signal line */
  fama: number;
  /** MESA Adaptive Moving Average: hugs price during trends and flattens out in congestion */
  mama: number;
};

type MAMAState = {
  barsTotal: number;
  detrenders: number[];
  fama: number;
  i2: number;
  im: number;
  mama: number;
  period: number;
  phase: number;
  prices: number[];
  q2: number;
  quadratures: number[];
  re: number;
  smoothed: number[];
};

/*
 * Transfer response coefficients of Ehlers' Hilbert transform approximation. Together with the
 * per-bar amplitude adjustment they keep the quadrature component's amplitude flat across the
 * cycle periods the transform is tuned for (Ehlers, TASC September 2001).
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
 * MESA Adaptive Moving Average (MAMA)
 * Type: Trend
 *
 * John Ehlers' MAMA ("MESA Adaptive Moving Averages", Technical Analysis of Stocks & Commodities,
 * September 2001) is an exponential average whose smoothing factor adapts to the market's dominant
 * cycle, measured in-line by a Hilbert transform with a homodyne discriminator. The average speeds
 * up as the phase advances quickly (trending price) and slows to a crawl when the phase stalls
 * (congestion), so it hugs trends with minimal lag yet barely wiggles through sideways chop.
 * The companion FAMA (Following Adaptive Moving Average) applies half of MAMA's smoothing to the
 * MAMA line itself, forming a slower signal line of the same adaptive nature.
 *
 * Interpretation: MAMA trading above FAMA signals bullish pressure, MAMA below FAMA bearish
 * pressure. Because both lines freeze together in congestion, their crossovers happen close to
 * price turns instead of several bars late as with fixed-length average pairs.
 *
 * @see https://www.mesasoftware.com/papers/MAMA.pdf
 * @see https://github.com/TA-Lib/ta-lib/blob/main/src/ta_func/ta_MAMA.c
 */
export class MAMA extends TechnicalIndicator<MAMAResult, number, MAMAState> {
  public readonly fastLimit: number;
  public readonly slowLimit: number;
  #previousResult?: MAMAResult;

  protected override state: MAMAState = {
    barsTotal: 0,
    detrenders: [],
    fama: 0,
    i2: 0,
    im: 0,
    mama: 0,
    period: 0,
    phase: 0,
    prices: [],
    q2: 0,
    quadratures: [],
    re: 0,
    smoothed: [],
  };

  constructor({fastLimit = 0.5, slowLimit = 0.05}: MAMAConfig = {}) {
    super();
    this.fastLimit = fastLimit;
    this.slowLimit = slowLimit;
  }

  /**
   * Mirrors the TA-Lib lookback of 32 bars: 12 bars reserved for the price smoother (kept for
   * compatibility with the TradeStation implementation in Ehlers' book), 6 for the detrender,
   * 6 for the quadrature component, 3 for advancing each component's phase, 1 for the homodyne
   * discriminator and 1 for the phase delta. The recursive averages inside keep settling after
   * the first emission, exactly as TA-Lib emits them with its default unstable period of zero.
   */
  override getRequiredInputs() {
    return 33;
  }

  update(price: number, replace: boolean) {
    this.trackState(replace);

    const state = this.state;
    state.barsTotal++;

    pushCapped(state.prices, price, 4);

    // The cycle measurement engages only once the price smoother's warm-up bars have passed
    if (state.barsTotal <= 12) {
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

    const previousPhase = state.phase;
    state.phase = i1 !== 0 ? Math.atan(q1 / i1) * RAD_TO_DEG : 0;

    /*
     * The faster the phase advances, the faster the average is allowed to move. A phase advance
     * below one degree counts as one, which caps the smoothing at the fast limit.
     */
    const deltaPhase = Math.max(previousPhase - state.phase, 1);
    const alpha = Math.max(this.fastLimit / deltaPhase, this.slowLimit);

    state.mama = alpha * price + (1 - alpha) * state.mama;
    state.fama = 0.5 * alpha * state.mama + (1 - 0.5 * alpha) * state.fama;

    if (state.barsTotal < this.getRequiredInputs()) {
      return null;
    }

    if (replace) {
      this.result = this.#previousResult;
    }

    this.#previousResult = this.result;

    return (this.result = {
      fama: state.fama,
      mama: state.mama,
    });
  }

  protected calculateSignal(result?: MAMAResult | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isBullish = hasResult && result.mama > result.fama;
    const isBearish = hasResult && result.mama < result.fama;

    switch (true) {
      case !hasResult:
        return TradingSignal.UNKNOWN;
      case isBullish:
        return TradingSignal.BULLISH;
      case isBearish:
        return TradingSignal.BEARISH;
      default:
        return TradingSignal.SIDEWAYS;
    }
  }

  getSignal(): {
    state: (typeof TradingSignal)[keyof typeof TradingSignal];
    hasChanged: boolean;
  } {
    const previousState = this.calculateSignal(this.#previousResult);
    const state = this.calculateSignal(this.getResult());
    const hasChanged = previousState !== state;

    return {
      hasChanged,
      state,
    };
  }
}
