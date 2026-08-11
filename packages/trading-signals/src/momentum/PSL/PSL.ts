import {ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

export type PSLConfig = {
  /** Number of close-to-close comparisons in the window; the warm-up needs one close more than this */
  interval?: number;
  signalThresholds?: SignalThresholds;
};

/**
 * Psychological Line (PSL)
 * Type: Momentum
 *
 * The Psychological Line reads crowd sentiment straight off the tape: it is the percentage of the last N bars
 * (12 by default) that closed above their previous close, oscillating between 0 and 100. It originated as a
 * sentiment gauge in East Asian markets and remains a standard indicator on Asian trading platforms (often
 * labeled PSY): when nearly every recent bar closed higher, optimism is judged to be overheating; when almost
 * none did, panic selling is considered exhausted.
 *
 * Only a strictly higher close counts as a rising period — an unchanged close is treated as a falling one,
 * matching the pandas-ta reference implementation.
 *
 * Interpretation:
 * A PSL of 75 or above (at least 9 of the default 12 bars closed up) indicates an overbought condition, 25 or
 * below (at most 3 of 12) indicates an oversold condition (both thresholds can be customized via the
 * constructor). These are the conventional bands on the Asian platforms where the indicator is canonical.
 *
 * @see https://github.com/xgboosted/pandas-ta-classic/blob/main/pandas_ta_classic/momentum/psl.py
 * @see https://www.moomoo.com/us/support/topic3_814
 * @see https://www.quantshare.com/item-851-psychological-line
 */
export class PSL extends ThresholdCrossSeries {
  readonly #closes: number[] = [];
  public readonly interval: number;

  constructor({interval = 12, signalThresholds: {overbought = 75, oversold = 25} = {}}: PSLConfig = {}) {
    super({overbought, oversold});
    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval + 1;
  }

  update(close: number, replace: boolean) {
    pushUpdate({array: this.#closes, item: close, maxLength: this.getRequiredInputs(), replace: replace});

    if (this.#closes.length < this.getRequiredInputs()) {
      return null;
    }

    let risingPeriods = 0;

    for (let i = 1; i < this.#closes.length; i++) {
      if (this.#closes[i] > this.#closes[i - 1]) {
        risingPeriods++;
      }
    }

    return this.setResult((100 * risingPeriods) / this.interval, replace);
  }
}
