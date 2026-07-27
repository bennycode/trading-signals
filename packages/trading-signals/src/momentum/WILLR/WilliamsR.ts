import {TradingSignal, TrendIndicatorSeries} from '../../base/Indicator.js';
import type {HighLowClose} from '../../base/Candle.type.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Williams %R (Williams Percent Range)
 * Type: Momentum
 *
 * The Williams %R indicator, developed by Larry Williams, is a momentum indicator that measures overbought
 * and oversold levels. It is similar to the Stochastic Oscillator but is plotted on an inverted scale,
 * ranging from 0 to -100. Readings from 0 to -20 are considered overbought, while readings from -80 to -100
 * are considered oversold.
 *
 * The Williams %R is arithmetically exactly equivalent to the %K stochastic oscillator, mirrored at the 0%-line.
 *
 * Formula: %R = (Highest High - Close) / (Highest High - Lowest Low) × -100
 *
 * @see https://en.wikipedia.org/wiki/Williams_%25R
 * @see https://www.investopedia.com/terms/w/williamsr.asp
 */
export class WilliamsR extends TrendIndicatorSeries<HighLowClose<number>> {
  public readonly candles: HighLowClose<number>[] = [];

  public readonly interval: number;
  readonly #overbought: number;
  readonly #oversold: number;

  constructor(interval: number, {overbought = -20, oversold = -80}: SignalThresholds = {}) {
    super();
    this.interval = interval;
    this.#overbought = overbought;
    this.#oversold = oversold;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  override update(candle: HighLowClose<number>, replace: boolean) {
    pushUpdate(this.candles, replace, candle, this.interval);

    if (this.candles.length === this.interval) {
      let highest = this.candles[0].high;
      let lowest = this.candles[0].low;

      for (let i = 1; i < this.candles.length; i++) {
        if (this.candles[i].high > highest) {
          highest = this.candles[i].high;
        }

        if (this.candles[i].low < lowest) {
          lowest = this.candles[i].low;
        }
      }

      const divisor = highest - lowest;

      if (divisor === 0) {
        return this.setResult(-100, replace);
      }

      const willR = ((highest - candle.close) / divisor) * -100;
      return this.setResult(willR, replace);
    }

    return null;
  }

  protected calculateSignalState(result?: number | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isOverbought = hasResult && result >= this.#overbought;
    const isOversold = hasResult && result <= this.#oversold;

    switch (true) {
      case !hasResult:
        return TradingSignal.UNKNOWN;
      case isOverbought:
        return TradingSignal.BULLISH;
      case isOversold:
        return TradingSignal.BEARISH;
      default:
        return TradingSignal.SIDEWAYS;
    }
  }
}
