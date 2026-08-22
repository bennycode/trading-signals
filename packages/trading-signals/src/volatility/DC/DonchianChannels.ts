import type {HighLow} from '../../base/Candle.type.js';
import {IndicatorInputShape, TechnicalIndicator} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/index.js';

export type DonchianChannelsResult = {
  lower: number;
  middle: number;
  upper: number;
};

/**
 * Donchian Channels (DC)
 * Type: Volatility
 *
 * Donchian Channels were developed by Richard Donchian, a pioneer of trend following. The upper band marks the
 * highest high and the lower band the lowest low of the last candles, with the middle band halfway between the two.
 * The channel frames the recent trading range: a widening channel signals rising volatility, a narrowing channel a
 * quiet market. Trend followers — most famously the Turtle Traders — read a new channel extreme as a breakout level.
 *
 * Following the classic definition, the current candle is part of the channel. Some libraries (e.g.
 * Skender.Stock.Indicators) build the channel from the preceding candles only, which yields the same series shifted
 * by one candle.
 *
 * @see https://www.investopedia.com/terms/d/donchianchannels.asp
 * @see https://dotnet.stockindicators.dev/indicators/Donchian/
 */
export class DonchianChannels extends TechnicalIndicator<DonchianChannelsResult, HighLow<number>> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW;

  readonly #candles: HighLow<number>[] = [];
  public readonly interval: number;

  constructor(interval: number = 20) {
    super();
    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(candle: HighLow<number>, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.interval, replace: replace});

    if (this.#candles.length < this.interval) {
      return null;
    }

    // A single pass over the window keeps the hot path free of per-candle array allocations
    let upper = this.#candles[0].high;
    let lower = this.#candles[0].low;

    for (const {high, low} of this.#candles) {
      upper = Math.max(upper, high);
      lower = Math.min(lower, low);
    }

    return (this.result = {
      lower,
      middle: (upper + lower) / 2,
      upper,
    });
  }
}
