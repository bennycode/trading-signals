import type {TradingSignals} from '../../types/Indicator.js';
import {TradingSignal, TrendIndicatorSeries} from '../../types/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Momentum Indicator (MOM / MTM)
 * Type: Momentum
 *
 * The Momentum indicator returns the change between the current price and the price n times ago.
 *
 * @see https://en.wikipedia.org/wiki/Momentum_(technical_analysis)
 * @see https://www.warriortrading.com/momentum-indicator/
 */
export class MOM extends TrendIndicatorSeries {
  private readonly history: number[];
  private readonly historyLength: number;
  private periodCounter: number = 0;
  private lastEvaluationResult?: number;
  private lastSignal: TradingSignals = TradingSignal.UNKNOWN;

  constructor(public readonly interval: number) {
    super();
    this.historyLength = interval + 1;
    this.history = [];
  }

  override getRequiredInputs() {
    return this.historyLength;
  }

  update(value: number, replace: boolean) {
    pushUpdate(this.history, replace, value, this.historyLength);

    if (this.history.length === this.historyLength) {
      const result = value - this.history[0];

      if (!replace) {
        this.periodCounter++;

        // Store result at signal evaluation points (before incrementing)
        // This stores the result from the PREVIOUS evaluation point
        if (this.periodCounter > 1 && (this.periodCounter - 1) % this.interval === 0 && this.periodCounter > 1) {
          this.lastEvaluationResult = this.result;
        }
      }

      return this.setResult(result, replace);
    }

    return null;
  }

  protected calculateSignalState(result?: number | null | undefined) {
    const hasResult = result !== null && result !== undefined;

    if (!hasResult) {
      return TradingSignal.UNKNOWN;
    }

    // Only evaluate signal every `interval` periods
    if (this.periodCounter % this.interval !== 0) {
      return this.lastSignal;
    }

    // At signal evaluation points, compare with last evaluation result
    if (!this.lastEvaluationResult) {
      // First signal evaluation point - return SIDEWAYS (nothing to compare with)
      return this.lastSignal;
    }

    // Compare current result with result from last signal evaluation
    if (result > this.lastEvaluationResult) {
      this.lastSignal = TradingSignal.BULLISH;
    } else if (result < this.lastEvaluationResult) {
      this.lastSignal = TradingSignal.BEARISH;
    } else {
      this.lastSignal = TradingSignal.SIDEWAYS;
    }

    return this.lastSignal;
  }
}
