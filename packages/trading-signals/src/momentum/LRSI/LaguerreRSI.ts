import {ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';

export type LaguerreRSIConfig = {
  /**
   * Damping factor of the Laguerre filter, at least 0 and below 1 (default: 0.5). Zero turns the
   * filter into a pure delay line of the last four closes; values closer to 1 stretch the
   * effective look-back and calm the oscillator.
   */
  gamma?: number;
  signalThresholds?: SignalThresholds;
};

/**
 * The recursion's complete memory: the four filter stages as the latest bar left them, plus how
 * many bars have charged the filter, which gates the warm-up.
 */
type LaguerreRSIState = {
  barsTotal: number;
  l0: number;
  l1: number;
  l2: number;
  l3: number;
};

/**
 * Laguerre RSI (LRSI)
 * Type: Momentum
 *
 * John Ehlers published the Laguerre RSI in "Cybernetic Analysis for Stocks and Futures" (2004),
 * chapter 14. A four-stage Laguerre filter warps time: the first stage reacts to the newest
 * close while each further stage stretches its memory deeper into the past, so an RSI-style
 * pressure reading over just the four stage outputs behaves like a classic RSI over a much
 * longer window yet turns with far less lag. The reading is the share of upward pressure
 * between adjacent stages and ranges from 0 to 1.
 *
 * The filter stages charge up from zero, so the earliest readings carry a fading seed transient —
 * like an EMA seeded at zero — until the price level has propagated through all four stages.
 * A filter whose stages have fully leveled out carries no pressure in either direction and reads
 * 0 here; implementations diverge on this point (Ehlers' TradeStation code holds the previous
 * reading, StockSharp emits its neutral level). StockSharp additionally smooths both pressure
 * sums with the damping factor and scales the result to 0-100, which this implementation does
 * not — it follows Ehlers' book.
 *
 * Interpretation:
 * A reading of 0.8 or above indicates an overbought market and 0.2 or below an oversold market
 * (Ehlers' bands — note the 0-1 scale; both thresholds can be customized via the constructor).
 * Ehlers trades the crossings of these bands as entry triggers.
 *
 * @see https://www.mesasoftware.com/papers/TimeWarp.pdf
 * @see https://github.com/StockSharp/StockSharp/blob/master/Algo.Indicators/LaguerreRSI.cs
 */
export class LaguerreRSI extends ThresholdCrossSeries<number, LaguerreRSIState> {
  protected override state: LaguerreRSIState = {
    barsTotal: 0,
    l0: 0,
    l1: 0,
    l2: 0,
    l3: 0,
  };

  public readonly gamma: number;

  constructor({gamma = 0.5, signalThresholds: {overbought = 0.8, oversold = 0.2} = {}}: LaguerreRSIConfig = {}) {
    super({overbought, oversold});

    if (!Number.isFinite(gamma) || gamma < 0 || gamma >= 1) {
      throw new Error(`The gamma has to be at least 0 and below 1, but "${gamma}" was given.`);
    }

    this.gamma = gamma;
  }

  override getRequiredInputs() {
    /*
     * The recursion emits from the first bar, but only after four bars has price information
     * reached every filter stage (with zero damping the stages are literally the last four
     * closes). Readings shortly after still carry the zero seed's fading transient.
     */
    return 4;
  }

  update(price: number, replace: boolean) {
    this.trackState(replace);

    const {gamma} = this;
    const state = this.state;

    const l0 = (1 - gamma) * price + gamma * state.l0;
    const l1 = -gamma * l0 + state.l0 + gamma * state.l1;
    const l2 = -gamma * l1 + state.l1 + gamma * state.l2;
    const l3 = -gamma * l2 + state.l2 + gamma * state.l3;

    this.state = {barsTotal: state.barsTotal + 1, l0, l1, l2, l3};

    if (this.state.barsTotal < this.getRequiredInputs()) {
      return null;
    }

    // The time warp: pressure is read between adjacent filter stages instead of consecutive closes
    const stages = [l0, l1, l2, l3] as const;
    let upwardPressure = 0;
    let downwardPressure = 0;

    for (let i = 0; i < stages.length - 1; i++) {
      const difference = stages[i] - stages[i + 1];

      if (difference >= 0) {
        upwardPressure += difference;
      } else {
        downwardPressure -= difference;
      }
    }

    const totalPressure = upwardPressure + downwardPressure;

    // A fully leveled filter offers no pressure to weigh in either direction (see the class doc)
    if (totalPressure === 0) {
      return this.setResult(0, replace);
    }

    return this.setResult(upwardPressure / totalPressure, replace);
  }
}
