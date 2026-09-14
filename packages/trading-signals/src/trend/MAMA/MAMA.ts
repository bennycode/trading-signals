import {IndicatorInputShape, TradingSignal, TrendIndicator} from '../../base/Indicator.js';
import type {HilbertCycleState} from '../HT/HilbertTransform.js';
import {createHilbertCycleState, measureDominantCycle, pushCapped} from '../HT/HilbertTransform.js';

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

type MAMAState = HilbertCycleState & {
  barsTotal: number;
  fama: number;
  mama: number;
  phase: number;
  prices: number[];
};

const RAD_TO_DEG = 180 / Math.PI;

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
export class MAMA extends TrendIndicator<MAMAResult, number, MAMAState> {
  override readonly inputShape = IndicatorInputShape.VALUE;

  public readonly fastLimit: number;
  public readonly slowLimit: number;

  protected override state: MAMAState = {
    ...createHilbertCycleState(),
    barsTotal: 0,
    fama: 0,
    mama: 0,
    phase: 0,
    prices: [],
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

    const {i1, q1} = measureDominantCycle(state, state.prices);

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

    return this.setResult(
      {
        fama: state.fama,
        mama: state.mama,
      },
      replace
    );
  }

  protected calculateSignalState(result?: MAMAResult | null | undefined) {
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
}
