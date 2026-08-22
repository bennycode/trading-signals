import {IndicatorInputShape, ZeroCrossSeries} from '../../base/Indicator.js';
import {SMA} from '../../trend/SMA/SMA.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

/**
 * Detrended Price Oscillator (DPO)
 * Type: Momentum
 *
 * The Detrended Price Oscillator strips the prevailing trend out of price by comparing a past
 * close against the moving average of the bars surrounding it. What remains is the short-term
 * price cycle, which makes it easier to gauge the length and magnitude of swings between cycle
 * highs and lows.
 *
 * The compared close sits half an interval plus one bar in the past, so each reading describes
 * the cycle at that earlier bar — not at the most recent candle. DPO is a tool for measuring
 * cycles, not for timing entries on the latest bar.
 *
 * Interpretation: A reading above zero means price traded above its surrounding average (a cycle
 * high is forming), while a reading below zero means price traded beneath it (a cycle low is
 * forming).
 *
 * @see https://tulipindicators.org/dpo
 * @see https://www.investopedia.com/terms/d/detrended-price-oscillator-dpo.asp
 */
export class DPO extends ZeroCrossSeries {
  override readonly inputShape = IndicatorInputShape.VALUE;

  public readonly interval: number;
  readonly #average: SMA;
  readonly #displacement: number;
  readonly #history: number[];
  readonly #historyLength: number;

  constructor(interval: number = 20) {
    super();
    this.interval = interval;
    // Half an interval plus one bar centers the average window on the compared close
    this.#displacement = Math.floor(interval / 2) + 1;
    this.#history = [];
    this.#historyLength = this.#displacement + 1;
    this.#average = new SMA(interval);
  }

  override getRequiredInputs() {
    // Very short intervals need more bars for the displaced close than for the average
    return Math.max(this.interval, this.#historyLength);
  }

  update(price: number, replace: boolean) {
    pushUpdate({array: this.#history, item: price, maxLength: this.#historyLength, replace: replace});

    const average = this.#average.update(price, replace);

    if (this.#history.length === this.#historyLength && average !== null) {
      return this.setResult(this.#history[0] - average, replace);
    }

    return null;
  }
}
