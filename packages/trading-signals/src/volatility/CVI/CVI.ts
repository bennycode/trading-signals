import type {HighLow} from '../../base/Candle.type.js';
import {ZeroCrossSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Chaikin Volatility (CVI)
 * Type: Volatility
 *
 * Marc Chaikin's volatility gauge measures widening-range momentum: it smooths the daily trading
 * range (high minus low) and reports how much that smoothed range has grown or shrunk over the
 * lookback, as a percentage. A positive reading means volatility is expanding, a negative reading
 * means it is contracting, so a zero-cross flags a change of volatility regime.
 *
 * Interpretation: Range expansion carries no direction on its own — Chaikin's own reading pairs it
 * with price direction: a volatility spike while prices fall often marks panic selling near a
 * market bottom, whereas volatility that fades while prices rise points to a maturing, complacent
 * uptrend nearing a top. A lookback of dead-flat candles offers no volatility baseline to measure
 * growth against, so the reading is pinned to zero (sideways) instead of an undefined change.
 *
 * @see https://tulipindicators.org/cvi
 * @see https://www.metastock.com/customer/resources/taaz/?p=120
 */
export class CVI extends ZeroCrossSeries<HighLow<number>> {
  public readonly interval: number;
  readonly #smoothedRange: EMA;
  readonly #smoothedRangeHistory: number[];
  readonly #historyLength: number;

  constructor(interval: number = 10) {
    super();
    this.interval = interval;
    this.#smoothedRange = new EMA(interval);
    this.#smoothedRangeHistory = [];
    this.#historyLength = interval + 1;
  }

  override getRequiredInputs() {
    return this.interval * 2;
  }

  update({high, low}: HighLow<number>, replace: boolean) {
    this.#smoothedRange.update(high - low, replace);

    const smoothedRange = this.#smoothedRange.getResult();

    if (smoothedRange === null) {
      return null;
    }

    pushUpdate({
      array: this.#smoothedRangeHistory,
      item: smoothedRange,
      maxLength: this.#historyLength,
      replace,
    });

    if (this.#smoothedRangeHistory.length < this.#historyLength) {
      return null;
    }

    const laggedRange = this.#smoothedRangeHistory[0];

    /*
     * A dead-flat lookback leaves no volatility baseline, so the reading pins to zero (sideways)
     * rather than reporting an undefined percentage change.
     */
    if (laggedRange === 0) {
      return this.setResult(0, replace);
    }

    return this.setResult((100 * (smoothedRange - laggedRange)) / laggedRange, replace);
  }
}
