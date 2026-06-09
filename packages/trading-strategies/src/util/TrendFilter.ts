import type {MovingAverage} from 'trading-signals';

/**
 * Trend gate over a moving average. Feed it closing prices; once the MA is stable it reports
 * whether the latest price sits above the trend line. Strategies use it to veto noise-level
 * exits while the instrument is still in an uptrend — the classic fix for a percentage
 * trailing stop getting whipsawed out on a dip that never breaks the trend.
 *
 * Accepts any `trading-signals` moving average (`SMA`, `EMA`, `WSMA`, …) via their shared
 * {@link MovingAverage} base. The same primitive, fed an index series instead of the position's
 * own price, is the building block of {@link MarketRegimeFilter}.
 */
export class TrendFilter {
  readonly #ma: MovingAverage;

  constructor(movingAverage: MovingAverage) {
    this.#ma = movingAverage;
  }

  /** Push the next closing price into the underlying moving average. */
  add(close: number): void {
    this.#ma.add(close);
  }

  /** `true` once the moving average has enough data to produce a stable trend line. */
  get isReady() {
    return this.#ma.isStable;
  }

  /** Current trend line value, or `null` until the moving average is warmed up. */
  get value(): number | null {
    return this.#ma.isStable ? this.#ma.getResultOrThrow() : null;
  }

  /**
   * `true` when `price` is at or above the trend line. Returns `false` until the moving average
   * is stable — an un-warmed filter makes no claim, so callers naturally fall back to their
   * unfiltered behavior during warmup.
   */
  isAbove(price: number) {
    return this.#ma.isStable && price >= this.#ma.getResultOrThrow();
  }
}
