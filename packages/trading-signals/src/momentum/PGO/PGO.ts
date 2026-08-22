import type {HighLowClose} from '../../base/Candle.type.js';
import {IndicatorInputShape, ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {SMA} from '../../trend/SMA/SMA.js';
import {WSMA} from '../../trend/WSMA/WSMA.js';
import {ATR} from '../../volatility/ATR/ATR.js';

export type PGOConfig = {
  /** Number of candles used for the moving average of closes and for each smoothing stage of the true range */
  interval?: number;
  signalThresholds?: SignalThresholds;
};

/**
 * Pretty Good Oscillator (PGO)
 * Type: Momentum
 *
 * Created by Mark Johnson, the Pretty Good Oscillator measures how far the current close has traveled from its
 * N-day Simple Moving Average, expressed in units of average true range. Rescaling the distance by volatility
 * makes readings comparable across instruments and market phases: a 5-point rally means little in a market
 * that swings 10 points a day, but a lot in one that barely moves.
 *
 * Following the de-facto reference implementation (pandas-ta), the true range is smoothed twice: Wilder's
 * smoothing forms the Average True Range, and an EMA of that ATR forms the denominator. FM Labs documents a
 * variant that applies a single EMA directly to the true range.
 *
 * Interpretation:
 * Johnson used the oscillator as a breakout system for longer-term trades: a reading of +3.0 or more signals
 * a long breakout (bullish pressure), a reading of -3.0 or less a short breakout (bearish pressure). Both
 * thresholds can be customized via the constructor. A completely dead market offers no volatility yardstick
 * to measure distance with, so the oscillator reads neutral (0).
 *
 * @see https://www.fmlabs.com/reference/default.htm?url=PGO.htm
 * @see https://library.tradingtechnologies.com/trade/chrt-ti-pretty-good-oscillator.html
 * @see https://github.com/twopirllc/pandas-ta
 */
export class PGO extends ThresholdCrossSeries<HighLowClose<number>> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW_CLOSE;

  readonly #sma: SMA;
  readonly #atr: ATR;
  readonly #atrSmoothing: EMA;
  public readonly interval: number;

  constructor({interval = 14, signalThresholds: {overbought = 3, oversold = -3} = {}}: PGOConfig = {}) {
    super({overbought, oversold});

    this.interval = interval;
    this.#sma = new SMA(interval);
    // Wilder's smoothing forms the ATR before the EMA refines it, matching the pandas-ta reference
    this.#atr = new ATR(interval, WSMA);
    this.#atrSmoothing = new EMA(interval);
  }

  override getRequiredInputs() {
    // The two smoothing stages fill up in sequence: the second stage receives its first value on the candle that completes the first stage
    return this.#atr.getRequiredInputs() + this.#atrSmoothing.getRequiredInputs() - 1;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const sma = this.#sma.update(candle.close, replace);
    const atr = this.#atr.update(candle, replace);

    if (atr !== null) {
      this.#atrSmoothing.update(atr, replace);
    }

    if (sma === null || !this.#atrSmoothing.isStable) {
      return null;
    }

    const smoothedAtr = this.#atrSmoothing.getResultOrThrow();

    // A dead market leaves no distance to measure in units of volatility, so the reading is neutral
    if (smoothedAtr === 0) {
      return this.setResult(0, replace);
    }

    return this.setResult((candle.close - sma) / smoothedAtr, replace);
  }
}
