import {ATR, type HighLowClose} from 'trading-signals';

/**
 * Makes volatility comparable across instruments and timeframes: a raw $52 ATR means nothing
 * without the price, but "7% per bar" is directly comparable between a $7 and a $700 stock.
 */
export function atrToPercent(atr: number, price: number) {
  return (atr / price) * 100;
}

/**
 * Average True Range expressed as a percentage of the latest close — the "usual % move per bar".
 *
 * Built on the `ATR` indicator from `trading-signals`, so it inherits Wilder's smoothing. Useful
 * for sizing volatility-aware stops (see `atrTrailStop`) without hand-tuning a percentage per
 * symbol, and for asking "is this dip within the instrument's normal range?".
 */
export class AtrPercent {
  readonly #atr: ATR;
  #lastClose: number | null = null;

  constructor(interval: number) {
    this.#atr = new ATR(interval);
  }

  /** Push the next candle. Both the ATR and the reference close are updated. */
  add(candle: HighLowClose<number>): void {
    this.#atr.add(candle);
    this.#lastClose = candle.close;
  }

  get isReady() {
    return this.#atr.isStable;
  }

  /** Raw ATR in price units, or `null` until warmed up. */
  get atr() {
    return this.#atr.isStable ? this.#atr.getResultOrThrow() : null;
  }

  /**
   * ATR as a percent of the latest close (e.g. `7.1` for 7.1%), or `null` until warmed up or
   * before any candle has been added.
   */
  get value() {
    if (!this.#atr.isStable || this.#lastClose === null || this.#lastClose === 0) {
      return null;
    }

    return atrToPercent(this.#atr.getResultOrThrow(), this.#lastClose);
  }
}
