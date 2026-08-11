import {TradingSignal, TrendIndicatorSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {WSMA} from '../../trend/WSMA/WSMA.js';
import {pushUpdate} from '../../util/pushUpdate.js';

export type RMIConfig = {
  /** Number of bars in the Wilder smoothing of the up/down momentum streams */
  interval?: number;
  /** Number of bars back the compared close lies, i.e. the span of each momentum reading */
  momentum?: number;
  signalThresholds?: SignalThresholds;
};

/**
 * Relative Momentum Index (RMI)
 * Type: Momentum
 *
 * Developed by Roger Altman and published in Technical Analysis of Stocks & Commodities
 * (February 1993), the Relative Momentum Index generalizes the RSI: instead of judging each
 * close only against the close directly before it, momentum is measured as the close's change
 * over a configurable span of bars, and the up and down streams are smoothed with Wilder's
 * technique. Counting momentum across several bars filters bar-to-bar noise, so the oscillator
 * (0 to 100) swings more decisively between its extremes than the RSI. With a one-bar span the
 * RMI degenerates into the RSI.
 *
 * Interpretation:
 * A reading of 70 or above indicates an overbought market, a reading of 30 or below an oversold
 * market (both thresholds can be customized via the constructor). A market without down-momentum
 * reads 100 — a dead market included — which matches how this library's RSI reads a vanished
 * average loss.
 *
 * @see https://github.com/StockSharp/StockSharp/blob/master/Algo/Indicators/RelativeMomentumIndex.cs
 * @see https://docs.motivewave.com/studies/q-r#relative-momentum-index
 */
export class RMI extends TrendIndicatorSeries {
  readonly #closes: number[] = [];
  readonly #avgUpMomentum: WSMA;
  readonly #avgDownMomentum: WSMA;
  readonly #overbought: number;
  readonly #oversold: number;

  public readonly interval: number;
  public readonly momentum: number;

  constructor({interval = 14, momentum = 5, signalThresholds: {overbought = 70, oversold = 30} = {}}: RMIConfig = {}) {
    super();
    this.interval = interval;
    this.momentum = momentum;
    this.#avgUpMomentum = new WSMA(interval);
    this.#avgDownMomentum = new WSMA(interval);
    this.#overbought = overbought;
    this.#oversold = oversold;
  }

  override getRequiredInputs() {
    // The smoothing only starts receiving momentum once a close from the full span back exists
    return this.momentum + this.#avgUpMomentum.getRequiredInputs();
  }

  update(close: number, replace: boolean) {
    pushUpdate({array: this.#closes, item: close, maxLength: this.momentum + 1, replace});

    if (this.#closes.length <= this.momentum) {
      return null;
    }

    const spanStartClose = this.#closes[this.#closes.length - 1 - this.momentum];

    this.#avgUpMomentum.update(Math.max(close - spanStartClose, 0), replace);
    this.#avgDownMomentum.update(Math.max(spanStartClose - close, 0), replace);

    if (this.#avgUpMomentum.isStable) {
      const downMomentum = this.#avgDownMomentum.getResultOrThrow();

      // A market without down-momentum reads 100, matching the RSI's reading of a vanished average loss
      if (downMomentum === 0) {
        return this.setResult(100, replace);
      }

      const relativeMomentum = this.#avgUpMomentum.getResultOrThrow() / downMomentum;

      /*
       * Algebraically 100 × up / (up + down), but written with the RSI's arithmetic so that a
       * one-bar momentum span reproduces the RSI bit for bit.
       */
      return this.setResult(100 - 100 / (relativeMomentum + 1), replace);
    }

    return null;
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
