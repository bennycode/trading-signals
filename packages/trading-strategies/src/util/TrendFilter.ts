import type {MovingAverage} from 'trading-signals';

/**
 * Trend gate over a moving average. Feed it closing prices; once the MA is stable it reports
 * whether the latest price sits above the trend line. Strategies use it to veto noise-level
 * exits while the instrument is still in an uptrend — the classic fix for a percentage
 * trailing stop getting whipsawed out on a dip that never breaks the trend.
 */
export class TrendFilter {
  readonly #ma: MovingAverage;

  constructor(movingAverage: MovingAverage) {
    this.#ma = movingAverage;
  }

  add(close: number): void {
    this.#ma.add(close);
  }

  get isReady() {
    return this.#ma.isStable;
  }

  get value(): number | null {
    return this.#ma.isStable ? this.#ma.getResultOrThrow() : null;
  }

  isAbove(price: number) {
    return this.#ma.isStable && price >= this.#ma.getResultOrThrow();
  }
}
