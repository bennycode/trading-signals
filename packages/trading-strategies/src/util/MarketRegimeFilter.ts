import type {MovingAverage} from 'trading-signals';
import {TrendFilter} from './TrendFilter.js';

export interface MarketRegimeOptions {
  /** Moving average over the index that defines the regime trend line (e.g. a 50-period SMA of SPY). */
  trendMovingAverage: MovingAverage;
  /**
   * Optional maximum drawdown from the index's running peak close, in percent. When set, the
   * regime flips to risk-off once the index closes more than this far below its highest close
   * seen so far — even while it is still above the trend line. Omit to gate on the trend line
   * alone.
   */
  maxDrawdownPct?: number;
}

/**
 * Market-regime gate driven by a broad-market index series (e.g. SPY or QQQ — ETFs tracking the
 * S&P 500 and the Nasdaq-100). Pure and feed-agnostic: the caller pushes index closes from
 * wherever it sources them, so the calculation is reusable and unit-testable without any
 * cross-symbol plumbing in the trading session.
 *
 * This is what lets a strategy tell a broad market-wide selloff (honor the stop, get out) apart
 * from a dip in a single stock (one name can wobble while the whole market holds its trend — hold
 * through it). See {@link shouldExit} for the actionable signal.
 */
export class MarketRegimeFilter {
  readonly #trend: TrendFilter;
  readonly #maxDrawdownRatio: number | null;
  #peakClose = 0;
  #lastClose = 0;
  #hasData = false;

  constructor(options: MarketRegimeOptions) {
    this.#trend = new TrendFilter(options.trendMovingAverage);
    this.#maxDrawdownRatio = options.maxDrawdownPct === undefined ? null : options.maxDrawdownPct / 100;
  }

  addIndexClose(close: number): void {
    this.#trend.add(close);
    this.#lastClose = close;
    this.#hasData = true;

    if (close > this.#peakClose) {
      this.#peakClose = close;
    }
  }

  get isReady() {
    return this.#trend.isReady;
  }

  /** Drawdown from the running peak close as a positive ratio (`0` = at the peak, `0.1` = 10% below). */
  get drawdown() {
    if (!this.#hasData || this.#peakClose === 0) {
      return 0;
    }

    return (this.#peakClose - this.#lastClose) / this.#peakClose;
  }

  /**
   * `true` when the regime says exit: the broad market has turned risk-off — it closed below its
   * trend line, or fell more than the configured drawdown below its peak — so a strategy should get
   * defensive instead of riding the move out. `false` while the market is healthy (a single name
   * can wobble while the market holds its trend — hold through it), and also while the trend moving
   * average is still warming up, since an un-warmed filter makes no claim about the regime.
   */
  get shouldExit() {
    if (!this.isReady) {
      return false;
    }

    if (!this.#trend.isAbove(this.#lastClose)) {
      return true;
    }

    if (this.#maxDrawdownRatio !== null && this.drawdown > this.#maxDrawdownRatio) {
      return true;
    }

    return false;
  }
}
