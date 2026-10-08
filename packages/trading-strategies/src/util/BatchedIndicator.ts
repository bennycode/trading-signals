import {ms, type StringValue} from 'ms';
import {CandleBatcher} from '@typedtrader/exchange';
import type {BatchedCandle, Candle, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {TechnicalIndicator} from 'trading-signals';

/**
 * Runs an indicator on a larger timeframe than the 1-minute candles a strategy receives, e.g. an
 * SMA(3) over hourly bars. Only completed bars reach the indicator, so its result changes once per
 * interval rather than on every minute.
 */
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

  /** Returns the indicator's result when this candle completes an interval, otherwise `undefined`. */
  add(candle: OneMinuteBatchedCandle) {
    const bar = this.#batcher.addToBatch(candle);
    return bar ? this.indicator.add(this.#toInput(bar)) : undefined;
  }

  /** Feeds history that is already at the target interval, so the indicator is ready from the first live candle. */
  warmUp(bars: Candle[]) {
    for (const bar of bars) {
      this.indicator.add(this.#toInput(CandleBatcher.toBatchedCandle(bar)));
    }
  }
}
