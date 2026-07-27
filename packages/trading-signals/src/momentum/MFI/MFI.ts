import type {HighLowCloseVolume} from '../../base/Candle.type.js';
import {TradingSignal, TrendIndicatorSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Money Flow Index (MFI)
 * Type: Momentum
 *
 * The Money Flow Index was developed by Gene Quong and Avrum Soudack and is often described as a volume-weighted
 * RSI: instead of measuring price changes alone, it weights each candle's typical price by its trading volume, so a
 * move backed by heavy volume shifts the index more than the same move on thin volume. It oscillates between 0 and
 * 100.
 *
 * Interpretation:
 * An MFI of 80 or above indicates an overbought condition, 20 or below indicates an oversold condition (both
 * thresholds can be customized via the constructor). Divergence
 * between MFI and price (e.g. price makes a new high while MFI does not) can signal an upcoming reversal.
 *
 * @see https://www.investopedia.com/terms/m/mfi.asp
 * @see https://tulipindicators.org/mfi
 */
export class MFI extends TrendIndicatorSeries<HighLowCloseVolume<number>> {
  readonly #candles: HighLowCloseVolume<number>[] = [];
  readonly #overbought: number;
  readonly #oversold: number;
  public readonly interval: number;

  constructor(interval: number, {overbought = 80, oversold = 20}: SignalThresholds = {}) {
    super();
    this.interval = interval;
    this.#overbought = overbought;
    this.#oversold = oversold;
  }

  override getRequiredInputs() {
    return this.interval + 1;
  }

  update(candle: HighLowCloseVolume<number>, replace: boolean) {
    pushUpdate(this.#candles, replace, candle, this.getRequiredInputs());

    if (this.#candles.length < this.getRequiredInputs()) {
      return null;
    }

    const typicalPrices = this.#candles.map(({close, high, low}) => (high + low + close) / 3);
    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let i = 1; i < this.#candles.length; i++) {
      const rawMoneyFlow = typicalPrices[i] * this.#candles[i].volume;

      if (typicalPrices[i] > typicalPrices[i - 1]) {
        positiveFlow += rawMoneyFlow;
      } else if (typicalPrices[i] < typicalPrices[i - 1]) {
        negativeFlow += rawMoneyFlow;
      }
    }

    const totalFlow = positiveFlow + negativeFlow;

    // A completely flat market moves no money in either direction, so the index is neutral
    if (totalFlow === 0) {
      return this.setResult(50, replace);
    }

    return this.setResult((100 * positiveFlow) / totalFlow, replace);
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
