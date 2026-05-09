import {IndicatorSeries} from '../../types/Indicator.js';

/**
 * Relative Volume (RVOL).
 *
 * Compares the current input to the average of the *prior* `period` inputs (the current
 * value is **not** included in the baseline):
 *
 *     RVOL = currentVolume / mean(last `period` prior volumes)
 *
 * `1.0` = exactly average, `> 1` = elevated, `< 1` = below normal. Returns `null` (and
 * stays unstable) until `period` prior values have been seen, then on the (`period + 1`)th
 * input produces the first ratio. Returns `null` when the baseline is zero so callers can
 * decide whether to skip.
 *
 * Designed for daily-volume comparisons ("is today trading 1.5× the 10-day average?")
 * but works on any positive scalar series — pass per-bar volumes for any timeframe.
 *
 * @see https://arongroups.co/technical-analyze/relative-volume-indicator/
 */
export class RVOL extends IndicatorSeries<number> {
  readonly #period: number;
  readonly #priorVolumes: number[] = [];
  /** Snapshot of prior-volumes before the most recent update so `replace()` can roll back. */
  #snapshot: {priorVolumes: number[]; previousResult: number | undefined} | null = null;

  constructor(period: number) {
    super();
    if (period < 1) {
      throw new Error(`period must be >= 1, got ${period}`);
    }
    this.#period = period;
  }

  override getRequiredInputs() {
    // Need `period` prior values plus one current value to produce the first ratio.
    return this.#period + 1;
  }

  override update(volume: number, replace: boolean): number | null {
    if (replace) {
      if (!this.#snapshot) {
        throw new Error('Cannot replace before any input has been added.');
      }
      this.#priorVolumes.length = 0;
      this.#priorVolumes.push(...this.#snapshot.priorVolumes);
      this.previousResult = this.#snapshot.previousResult;
    } else {
      this.#snapshot = {
        previousResult: this.previousResult,
        priorVolumes: [...this.#priorVolumes],
      };
    }

    if (this.#priorVolumes.length < this.#period) {
      // Still warming up — accumulate prior values without producing a result.
      this.#priorVolumes.push(volume);
      return null;
    }

    // Baseline = mean of the last `period` prior values, *before* including this one.
    const window = this.#priorVolumes.slice(-this.#period);
    const baseline = window.reduce((a, b) => a + b, 0) / this.#period;

    // Shift the window forward; trim to bounded memory.
    this.#priorVolumes.push(volume);
    if (this.#priorVolumes.length > this.#period * 2) {
      this.#priorVolumes.splice(0, this.#priorVolumes.length - this.#period);
    }

    if (baseline === 0) {
      return null;
    }
    return this.setResult(volume / baseline, replace);
  }
}
