import {TradingSignal, TrendIndicatorSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Chande Momentum Oscillator (CMO)
 * Type: Momentum
 *
 * The Chande Momentum Oscillator was developed by Tushar Chande and relates the sum of gains to the sum of losses
 * over the interval. Unlike the RSI, which smooths both sides, the CMO uses the raw sums and keeps losses in the
 * denominator alongside gains — making it react faster and swing symmetrically between -100 and +100.
 *
 * Interpretation:
 * A value of +50 or above indicates an overbought condition, -50 or below indicates an oversold condition (both
 * thresholds can be customized via the constructor). Chande also used the absolute CMO level as a trend-strength
 * filter: the further from zero, the stronger the trend.
 *
 * @see https://www.investopedia.com/terms/c/chandemomentumoscillator.asp
 * @see https://tulipindicators.org/cmo
 */
export class CMO extends TrendIndicatorSeries {
  readonly #prices: number[] = [];
  readonly #overbought: number;
  readonly #oversold: number;

  public readonly interval: number;

  constructor(interval: number, {overbought = 50, oversold = -50}: SignalThresholds = {}) {
    super();
    this.interval = interval;
    this.#overbought = overbought;
    this.#oversold = oversold;
  }

  override getRequiredInputs() {
    return this.interval + 1;
  }

  update(price: number, replace: boolean) {
    pushUpdate(this.#prices, replace, price, this.getRequiredInputs());

    if (this.#prices.length < this.getRequiredInputs()) {
      return null;
    }

    let gains = 0;
    let losses = 0;

    for (let i = 1; i < this.#prices.length; i++) {
      const change = this.#prices[i] - this.#prices[i - 1];

      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const total = gains + losses;

    // A completely flat market has no momentum in either direction
    if (total === 0) {
      return this.setResult(0, replace);
    }

    return this.setResult((100 * (gains - losses)) / total, replace);
  }

  protected calculateSignalState(result: number | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isOversold = hasResult && result <= this.#oversold;
    const isOverbought = hasResult && result >= this.#overbought;

    switch (true) {
      case !hasResult:
        return TradingSignal.UNKNOWN;
      case isOversold:
        return TradingSignal.BEARISH;
      case isOverbought:
        return TradingSignal.BULLISH;
      default:
        return TradingSignal.SIDEWAYS;
    }
  }
}
