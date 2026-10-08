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
  readonly #intervalInMillis: number;
  #startedMidInterval: boolean | undefined;
  readonly #toInput: (bar: BatchedCandle) => Input;

  constructor(
    interval: StringValue,
    indicator: TechnicalIndicator<Result, Input>,
    toInput: (bar: BatchedCandle) => Input
  ) {
    this.indicator = indicator;
    this.#intervalInMillis = ms(interval);
    this.#batcher = new CandleBatcher(this.#intervalInMillis);
    this.#toInput = toInput;
  }

  getResult() {
    return this.indicator.getResult();
  }

  /**
   * Returns the indicator's result when this candle completes an interval, otherwise `undefined`. When the first
   * candle arrives mid-interval, the minutes before it are missing, so that first bar never reaches the indicator.
   */
  add(candle: OneMinuteBatchedCandle) {
    this.#startedMidInterval ??= candle.openTimeInMillis % this.#intervalInMillis !== 0;
    const bar = this.#batcher.addToBatch(candle);

    if (!bar) {
      return undefined;
    }

    if (this.#startedMidInterval) {
      this.#startedMidInterval = false;
      return undefined;
    }

    return this.indicator.add(this.#toInput(bar));
  }

  /** Feeds history that is already at the target interval, so the indicator is ready from the first live candle. */
  warmUp(bars: Candle[]) {
    for (const bar of bars) {
      this.indicator.add(this.#toInput(CandleBatcher.toBatchedCandle(bar)));
    }
  }
}
