import {IndicatorSeries} from '../../types/Indicator.js';
import {SMA} from '../../trend/SMA/SMA.js';

/**
 * Ratio of the current input to its trailing simple moving average.
 *
 * Designed for daily-volume comparisons ("is today trading 1.67× the 20-day average?"),
 * but works on any positive scalar series. For intraday RVOL (cumulative-vs-typical curve),
 * use `RVOL` — that one is session/time-of-day aware. `VolumeRatio` is the simpler
 * "current bar / N-bar average" comparison and doesn't need timestamps.
 *
 * Result: `1.0` = exactly average, `> 1` = elevated, `< 1` = below normal. Returns `null`
 * (and stays unstable) until `period` inputs have been added; returns `null` for the
 * single edge case of a zero-baseline (so callers can decide whether to skip).
 */
export class VolumeRatio extends IndicatorSeries<number> {
  readonly #sma: SMA;

  constructor(period: number) {
    super();
    this.#sma = new SMA(period);
  }

  override getRequiredInputs() {
    return this.#sma.getRequiredInputs();
  }

  override update(volume: number, replace: boolean): number | null {
    this.#sma.update(volume, replace);
    if (!this.#sma.isStable) {
      return null;
    }
    const baseline = this.#sma.getResultOrThrow();
    if (baseline === 0) {
      return null;
    }
    return this.setResult(volume / baseline, replace);
  }
}
