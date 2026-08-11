import type {OpenHighLowClose} from '../../base/Candle.type.js';
import {IndicatorSeries} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

/**
 * Swing Index (SI)
 * Type: Momentum
 *
 * Published by J. Welles Wilder in "New Concepts in Technical Trading Systems" (1978) — the same book that
 * introduced RSI, ATR and the Parabolic SAR — the Swing Index condenses two consecutive candles into a single
 * number that captures the "real" swing between them. Instead of only comparing closes, it weighs the
 * close-to-close move against opening gaps and candle bodies, so a bar that gaps and closes strongly scores a
 * bigger swing than one that merely drifts to the same close.
 *
 * Formula:
 * SI = 50 * (N / R) * (K / T), using Wilder's published symbols. "N" is the directed move: close-to-close change
 * plus half the current candle body plus a quarter of the previous body. "K" is the larger jump from the previous
 * close to the current high or low. "R" weighs the true range by which of the three moves dominates — the jump to
 * the high, the jump to the low, or the candle's own range — each adjusted by a quarter of the previous body.
 *
 * The divisor "T" is the "limit move", a futures-era scaling constant: Wilder designed the index for 1970s
 * commodity futures, where exchanges capped how far a price could move in one session. Modern markets rarely
 * enforce such caps, so "T" survives as a plain scaling factor — this implementation defaults to 300, the
 * convention popularized by MetaTrader and LEAN.
 *
 * Interpretation:
 * A single Swing Index reading is noisy on its own; Wilder designed it as the building block of the Accumulative
 * Swing Index, whose running total is read like a price chart. This class emits no standalone signal. Two
 * completely flat consecutive candles offer no swing to measure, so the index reads zero instead of dividing by
 * zero.
 *
 * @see https://archive.org/details/newconceptsintec00wild
 * @see https://www.metastock.com/customer/resources/taaz/?p=107
 * @see https://github.com/QuantConnect/Lean/blob/master/Indicators/WilderSwingIndex.cs
 */
export class SwingIndex extends IndicatorSeries<OpenHighLowClose> {
  readonly #limitMove: number;
  readonly #candles: OpenHighLowClose[] = [];

  constructor(limitMove: number = 300) {
    super();
    this.#limitMove = limitMove;
  }

  override getRequiredInputs() {
    return 2;
  }

  update(candle: OpenHighLowClose, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.getRequiredInputs(), replace});

    if (this.#candles.length < this.getRequiredInputs()) {
      return null;
    }

    const [previous, current] = this.#candles;
    const highMove = Math.abs(current.high - previous.close);
    const lowMove = Math.abs(current.low - previous.close);
    const rangeMove = Math.abs(current.high - current.low);
    const previousBodyWeight = 0.25 * Math.abs(previous.close - previous.open);

    // Wilder's "R": the true range weighted by whichever of the three moves dominates the bar
    let weightedRange: number;

    if (highMove >= lowMove && highMove >= rangeMove) {
      weightedRange = highMove - 0.5 * lowMove + previousBodyWeight;
    } else if (lowMove >= rangeMove) {
      weightedRange = lowMove - 0.5 * highMove + previousBodyWeight;
    } else {
      weightedRange = rangeMove + previousBodyWeight;
    }

    // Two flat candles in a row leave no swing to measure, so the index reads zero instead of dividing by zero
    if (weightedRange === 0) {
      return this.setResult(0, replace);
    }

    // Wilder's "N": the directed move, dominated by the close-to-close change
    const directedMove =
      current.close - previous.close + 0.5 * (current.close - current.open) + 0.25 * (previous.close - previous.open);
    // Wilder's "K": the larger jump from the previous close
    const strongestMove = Math.max(highMove, lowMove);

    return this.setResult(50 * (directedMove / weightedRange) * (strongestMove / this.#limitMove), replace);
  }
}
