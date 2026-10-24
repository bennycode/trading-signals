import {ms, type StringValue} from 'ms';
import {CandleBatcher} from '@typedtrader/exchange';
import type {BatchedCandle, Candle, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {TechnicalIndicator} from 'trading-signals';

export class BatchedIndicator<Result, Input> {
  readonly indicator: TechnicalIndicator<Result, Input>;
  readonly #batcher: CandleBatcher;
  readonly #toInput: (bar: BatchedCandle) => Input;

  constructor(
    interval: StringValue,
    indicator: TechnicalIndicator<Result, Input>,
    toInput: (bar: BatchedCandle) => Input
  ) {
    this.indicator = indicator;
    this.#batcher = new CandleBatcher(ms(interval));
    this.#toInput = toInput;
  }

  getResult() {
    return this.indicator.getResult();
  }

  /** Returns the indicator's result when this candle completes an interval, otherwise `undefined`. */
  add(candle: OneMinuteBatchedCandle) {
    const bar = this.#batcher.addToBatch(candle);
    return bar ? this.indicator.add(this.#toInput(bar)) : undefined;
  }

  /**
   * Feeds history that is already at the target interval, so the indicator is ready from the first live candle. Pass
   * the latest 1-minute candles as well, so the interval that is still running when live candles start is complete.
   */
  warmUp(bars: Candle[], minutes: Candle[] = []) {
    for (const bar of bars) {
      this.indicator.add(this.#toInput(CandleBatcher.toBatchedCandle(bar)));
    }

    const lastBar = bars.at(-1);
    const coveredUntil = lastBar ? lastBar.openTimeInMillis + lastBar.sizeInMillis : -Infinity;

    for (const minute of minutes) {
      if (minute.openTimeInMillis >= coveredUntil) {
        const bar = this.#batcher.addToBatch(minute);
        if (bar) {
          this.indicator.add(this.#toInput(bar));
        }
      }
    }
  }
}
