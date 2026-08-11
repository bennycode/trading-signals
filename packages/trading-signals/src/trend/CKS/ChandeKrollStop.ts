import type {HighLowClose} from '../../base/Candle.type.js';
import {TechnicalIndicator} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';
import {ATR} from '../../volatility/ATR/ATR.js';

export type ChandeKrollStopResult = {
  /** Trailing stop for long positions: the lowest of the recent preliminary stops above the lowest low */
  longStop: number;
  /** Trailing stop for short positions: the highest of the recent preliminary stops below the highest high */
  shortStop: number;
};

export type ChandeKrollStopConfig = {
  /** Number of candles for the highest high / lowest low and the ATR (default: 10) */
  interval?: number;
  /** How many ATRs the preliminary stop sits away from the window extreme (default: 1) */
  multiplier?: number;
  /** Number of preliminary stops the final stop lines pick their extreme from (default: 9) */
  stopInterval?: number;
};

/**
 * Chande Kroll Stop (CKS)
 * Type: Trend
 *
 * Published by Tushar Chande and Stanley Kroll in "The New Technical Trader" (Wiley, 1994). It derives a
 * volatility-adjusted trailing stop for each trade direction in two passes: a preliminary short stop hangs a multiple
 * of the Average True Range below the highest high, a preliminary long stop sits the same distance above the lowest
 * low. The final short stop is the highest preliminary short stop of the recent bars, the final long stop the lowest
 * preliminary long stop — so a single quiet bar cannot yank a stop into the price and shake out a healthy position.
 *
 * The long stop protects long positions (price crossing below it → exit), the short stop mirrors it above the price
 * for short positions. Both levels are always reported; which one matters depends on the trade the caller holds, so
 * the indicator reports no directional signal.
 *
 * @see https://www.tradingview.com/support/solutions/43000589105-chande-kroll-stop/
 * @see https://www.quantifiedstrategies.com/chande-kroll-stop/
 */
export class ChandeKrollStop extends TechnicalIndicator<ChandeKrollStopResult, HighLowClose<number>> {
  readonly #atr: ATR;
  readonly #candles: HighLowClose<number>[] = [];
  readonly #preliminaryStops: ChandeKrollStopResult[] = [];

  public readonly interval: number;
  public readonly multiplier: number;
  public readonly stopInterval: number;

  constructor({interval = 10, multiplier = 1, stopInterval = 9}: ChandeKrollStopConfig = {}) {
    super();
    this.interval = interval;
    this.multiplier = multiplier;
    this.stopInterval = stopInterval;
    this.#atr = new ATR(interval);
  }

  override getRequiredInputs() {
    return this.#atr.getRequiredInputs() + this.stopInterval - 1;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const atr = this.#atr.update(candle, replace);
    pushUpdate({array: this.#candles, item: candle, maxLength: this.interval, replace});

    // The candle window fills in lockstep with the ATR warm-up, so this single guard covers both
    if (atr === null) {
      return null;
    }

    let highestHigh = this.#candles[0].high;
    let lowestLow = this.#candles[0].low;

    for (let i = 1; i < this.#candles.length; i++) {
      if (this.#candles[i].high > highestHigh) {
        highestHigh = this.#candles[i].high;
      }

      if (this.#candles[i].low < lowestLow) {
        lowestLow = this.#candles[i].low;
      }
    }

    pushUpdate({
      array: this.#preliminaryStops,
      item: {
        longStop: lowestLow + this.multiplier * atr,
        shortStop: highestHigh - this.multiplier * atr,
      },
      maxLength: this.stopInterval,
      replace,
    });

    if (this.#preliminaryStops.length < this.stopInterval) {
      return null;
    }

    let longStop = this.#preliminaryStops[0].longStop;
    let shortStop = this.#preliminaryStops[0].shortStop;

    for (let i = 1; i < this.#preliminaryStops.length; i++) {
      if (this.#preliminaryStops[i].longStop < longStop) {
        longStop = this.#preliminaryStops[i].longStop;
      }

      if (this.#preliminaryStops[i].shortStop > shortStop) {
        shortStop = this.#preliminaryStops[i].shortStop;
      }
    }

    return (this.result = {longStop, shortStop});
  }
}
