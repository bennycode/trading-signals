import type {HighLowClose} from '../../base/Candle.type.js';
import {TechnicalIndicator} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';
import {ATR} from '../../volatility/ATR/ATR.js';

export type ChandelierExitResult = {
  /** Trailing stop for long positions: highest high minus a multiple of the ATR */
  long: number;
  /** Trailing stop for short positions: lowest low plus a multiple of the ATR */
  short: number;
};

export type ChandelierExitConfig = {
  /** Number of candles for the highest high / lowest low and the ATR (default: 22) */
  interval?: number;
  /** How many ATRs the stop trails behind the extreme (default: 3) */
  multiplier?: number;
};

/**
 * Chandelier Exit (CE)
 * Type: Trend
 *
 * The Chandelier Exit was developed by Charles Le Beau as a volatility-adjusted trailing stop: instead of exiting a
 * fixed distance below the entry, the stop hangs from the highest high of the trade (like a chandelier from a
 * ceiling) at a distance of a few average true ranges. Volatile markets get more room to breathe, quiet markets get
 * a tighter stop — keeping traders in trends until the move genuinely reverses.
 *
 * The long exit protects long positions (close below it → exit), the short exit mirrors it above the lowest low for
 * short positions.
 *
 * @see https://corporatefinanceinstitute.com/resources/equities/chandelier-exit/
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:chandelier_exit
 */
export class ChandelierExit extends TechnicalIndicator<ChandelierExitResult, HighLowClose<number>> {
  readonly #atr: ATR;
  readonly #candles: HighLowClose<number>[] = [];

  public readonly interval: number;
  public readonly multiplier: number;

  constructor({interval = 22, multiplier = 3}: ChandelierExitConfig = {}) {
    super();
    this.interval = interval;
    this.multiplier = multiplier;
    this.#atr = new ATR(interval);
  }

  override getRequiredInputs() {
    return this.#atr.getRequiredInputs();
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const atr = this.#atr.update(candle, replace);
    pushUpdate(this.#candles, replace, candle, this.interval);

    // The candle window fills in lockstep with the ATR warm-up, so this single guard covers both
    if (atr === null) {
      return null;
    }

    let highest = this.#candles[0].high;
    let lowest = this.#candles[0].low;

    for (let i = 1; i < this.#candles.length; i++) {
      if (this.#candles[i].high > highest) {
        highest = this.#candles[i].high;
      }

      if (this.#candles[i].low < lowest) {
        lowest = this.#candles[i].low;
      }
    }

    return (this.result = {
      long: highest - this.multiplier * atr,
      short: lowest + this.multiplier * atr,
    });
  }
}
