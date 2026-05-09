import {IndicatorSeries} from '../../types/Indicator.js';
import type {HighLow} from '../../types/HighLowClose.js';
import {SMA} from '../../trend/SMA/SMA.js';

/**
 * Average per-bar range (high − low), smoothed with an SMA.
 *
 * Cousin of `ATR`, but ignores prior-close — pure intraday range, no gap adjustment.
 * Useful when calibrating intraday take-profit / stop-loss thresholds: "what's a typical
 * one-bar move on this name?". On AMD 1-minute bars, average range was ~$0.55 on a
 * normal day, ~$1.20 on a high-volatility (event-driven) day.
 *
 * Use `ATR` instead when bars span a session boundary (daily / weekly) — there the gap
 * from the prior close is part of the move and shouldn't be hidden.
 *
 * @see https://www.investopedia.com/terms/a/atr.asp
 */
export class BarRange extends IndicatorSeries<HighLow> {
  readonly #sma: SMA;

  constructor(period: number) {
    super();
    this.#sma = new SMA(period);
  }

  override getRequiredInputs() {
    return this.#sma.getRequiredInputs();
  }

  override update(bar: HighLow, replace: boolean): number | null {
    this.#sma.update(bar.high - bar.low, replace);
    if (!this.#sma.isStable) {
      return null;
    }
    return this.setResult(this.#sma.getResultOrThrow(), replace);
  }
}
