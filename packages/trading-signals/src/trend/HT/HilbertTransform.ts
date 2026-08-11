/*
 * Transfer response coefficients of Ehlers' Hilbert transform approximation. Together with the
 * per-bar amplitude adjustment they keep the quadrature component's amplitude flat across the
 * cycle periods the transform is tuned for (Ehlers, TASC September 2001).
 */
const HILBERT_A = 0.0962;
const HILBERT_B = 0.5769;

const RAD_TO_DEG = 180 / Math.PI;

export const lag = (history: readonly number[], bars: number) => history.at(-1 - bars) ?? 0;

export const pushCapped = (history: number[], value: number, maxLength: number) => {
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
 * Working memory of the dominant-cycle measurement. Embedding it flat into an indicator's own
 * state keeps the whole measurement inside the indicator's replace/rollback snapshots.
 */
export type HilbertCycleState = {
  detrenders: number[];
  i2: number;
  im: number;
  period: number;
  q2: number;
  quadratures: number[];
  re: number;
  smoothed: number[];
};

export const createHilbertCycleState = (): HilbertCycleState => ({
  detrenders: [],
  i2: 0,
  im: 0,
  period: 0,
  q2: 0,
  quadratures: [],
  re: 0,
  smoothed: [],
});

/**
 * One bar of Ehlers' in-line dominant-cycle measurement: a Hilbert transform with a homodyne
 * discriminator, shared by the MESA Adaptive Moving Average and the Instantaneous Trendline.
 * Advances the smoothed period estimate held in the passed state and hands back the analytic
 * signal's in-phase and quadrature components for consumers that read the phase itself.
 */
export const measureDominantCycle = (state: HilbertCycleState, prices: readonly number[]) => {
  const adjustment = 0.075 * state.period + 0.54;

  const smoothed = (4 * lag(prices, 0) + 3 * lag(prices, 1) + 2 * lag(prices, 2) + lag(prices, 3)) / 10;
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

  return {i1, q1};
};
