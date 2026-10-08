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
  /** Last warm-up bar, until the first live candle tells whether it was still open. */
  #lastWarmUpBar: Candle | undefined;
  /** The bar that completes next was already fed as an unfinished warm-up bar, so it replaces that one. */
  #replaceNext = false;

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
    this.#resolveWarmUp(candle);
    const bar = this.#batcher.addToBatch(candle);

    if (!bar) {
      return undefined;
    }

    if (this.#replaceNext) {
      this.#replaceNext = false;
      return this.indicator.replace(this.#toInput(bar));
    }

    return this.indicator.add(this.#toInput(bar));
  }

  /**
   * Feeds history that is already at the target interval, so the indicator is ready from the first live candle. A live
   * data source usually returns the current, unfinished bar last. It counts for now and is replaced by the complete
   * bar once its interval ends.
   */
  warmUp(bars: Candle[]) {
    for (const bar of bars) {
      this.indicator.add(this.#toInput(CandleBatcher.toBatchedCandle(bar)));
    }
    this.#lastWarmUpBar = bars.at(-1);
  }

  #resolveWarmUp(candle: OneMinuteBatchedCandle) {
    const lastBar = this.#lastWarmUpBar;
    this.#lastWarmUpBar = undefined;

    if (!lastBar) {
      return;
    }

    const elapsed = candle.openTimeInMillis - lastBar.openTimeInMillis;

    if (elapsed < 0 || elapsed >= lastBar.sizeInMillis) {
      return;
    }

    this.#replaceNext = true;

    if (elapsed > 0) {
      // The warm-up bar holds the interval's minutes before this candle; live minutes complete it.
      this.#batcher.addToBatch({...lastBar, sizeInMillis: elapsed});
    }
  }
}
