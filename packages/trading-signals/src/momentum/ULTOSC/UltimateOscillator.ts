import type {HighLowClose} from '../../base/Candle.type.js';
import {TradingSignal, TrendIndicatorSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {pushUpdate} from '../../util/pushUpdate.js';

export type UltimateOscillatorConfig = {
  /** Number of candles in the long lookback (default: 28) */
  longPeriod?: number;
  /** Number of candles in the medium lookback (default: 14) */
  mediumPeriod?: number;
  /** Number of candles in the short lookback (default: 7) */
  shortPeriod?: number;
};

/**
 * Ultimate Oscillator (ULTOSC)
 * Type: Momentum
 *
 * The Ultimate Oscillator was developed by Larry Williams and measures buying pressure across three timeframes at
 * once, weighting the shortest 4x and the medium 2x. Single-period oscillators often flash a divergence right before
 * the move continues; blending three timeframes was Williams' answer to those false signals. It oscillates between
 * 0 and 100.
 *
 * Interpretation:
 * A value of 70 or above indicates an overbought condition, 30 or below indicates an oversold condition (both
 * thresholds can be customized via the constructor). Williams' original strategy trades divergences between the
 * oscillator and price rather than the raw levels.
 *
 * @see https://www.investopedia.com/terms/u/ultimateoscillator.asp
 * @see https://tulipindicators.org/ultosc
 */
export class UltimateOscillator extends TrendIndicatorSeries<HighLowClose<number>> {
  readonly #candles: HighLowClose<number>[] = [];
  readonly #overbought: number;
  readonly #oversold: number;

  public readonly shortPeriod: number;
  public readonly mediumPeriod: number;
  public readonly longPeriod: number;

  constructor(
    {longPeriod = 28, mediumPeriod = 14, shortPeriod = 7}: UltimateOscillatorConfig = {},
    {overbought = 70, oversold = 30}: SignalThresholds = {}
  ) {
    super();
    this.shortPeriod = shortPeriod;
    this.mediumPeriod = mediumPeriod;
    this.longPeriod = longPeriod;
    this.#overbought = overbought;
    this.#oversold = oversold;
  }

  override getRequiredInputs() {
    return this.longPeriod + 1;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    pushUpdate(this.#candles, replace, candle, this.getRequiredInputs());

    if (this.#candles.length < this.getRequiredInputs()) {
      return null;
    }

    const buyingPressures: number[] = [];
    const trueRanges: number[] = [];

    for (let i = 1; i < this.#candles.length; i++) {
      const {close, high, low} = this.#candles[i];
      const previousClose = this.#candles[i - 1].close;
      const trueLow = Math.min(low, previousClose);
      const trueHigh = Math.max(high, previousClose);

      buyingPressures.push(close - trueLow);
      trueRanges.push(trueHigh - trueLow);
    }

    const average = (period: number) => {
      let buyingPressureSum = 0;
      let trueRangeSum = 0;

      for (let i = trueRanges.length - period; i < trueRanges.length; i++) {
        buyingPressureSum += buyingPressures[i];
        trueRangeSum += trueRanges[i];
      }

      return {buyingPressureSum, trueRangeSum};
    };

    const short = average(this.shortPeriod);

    /*
     * A flat short window has no true range to weight, so the oscillator is neutral. The lookbacks are nested
     * (short ⊆ medium ⊆ long) and true ranges are non-negative, so the longer windows can only be flat when the
     * short one is — this single guard covers every division by zero.
     */
    if (short.trueRangeSum === 0) {
      return this.setResult(50, replace);
    }

    const medium = average(this.mediumPeriod);
    const long = average(this.longPeriod);

    const shortAverage = short.buyingPressureSum / short.trueRangeSum;
    const mediumAverage = medium.buyingPressureSum / medium.trueRangeSum;
    const longAverage = long.buyingPressureSum / long.trueRangeSum;

    return this.setResult((100 * (4 * shortAverage + 2 * mediumAverage + longAverage)) / 7, replace);
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
