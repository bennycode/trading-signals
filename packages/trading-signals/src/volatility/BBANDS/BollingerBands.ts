import {TradingSignal, TrendTechnicalIndicator} from '../../types/Indicator.js';
import type {BandsResult} from '../../types/BandsResult.js';
import {getAverage, getStandardDeviation, pushUpdate} from '../../util/index.js';

/**
 * Bollinger Bands (BBANDS)
 * Type: Volatility
 *
 * Bollinger Bands (BBANDS), developed by John A. Bollinger, are set as an envelope around a moving average. Narrow bands indicate a sideways trend (ranging markets). To determine a breakout direction, [Investopia.com suggests](https://www.investopedia.com/articles/technical/04/030304.asp) to use the relative strength index (RSI) along with one or two volume-based indicators such as the intraday intensity index (developed by David Bostian) or the accumulation/distribution index (developed by Larry William).
 *
 * When the upper and lower bands expand, there can be "M" and "W" formations. The "W" formation indicates a bullish movement and the "M" formation indicates a bearish movement.
 *
 * @see https://www.investopedia.com/terms/b/bollingerbands.asp
 */
export class BollingerBands extends TrendTechnicalIndicator<BandsResult> {
  public readonly prices: number[] = [];
  #lastPrice?: number;
  #previousPrice?: number;

  public readonly interval: number;
  public readonly deviationMultiplier: number;

  constructor(interval: number, deviationMultiplier: number = 2) {
    super();
    this.interval = interval;
    this.deviationMultiplier = deviationMultiplier;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    pushUpdate(this.prices, replace, price, this.interval);

    /*
     * Rewind the price history so "calculateSignalState" sees the price that belonged to
     * "previousResult" while "setResult" re-caches the previous signal state
     */
    if (replace) {
      this.#lastPrice = this.#previousPrice;
    }

    let result: BandsResult | null = null;

    if (this.prices.length === this.interval) {
      const middle = getAverage(this.prices);
      const standardDeviation = getStandardDeviation(this.prices, middle);

      result = this.setResult(
        {
          lower: middle - standardDeviation * this.deviationMultiplier,
          middle,
          upper: middle + standardDeviation * this.deviationMultiplier,
        },
        replace
      );
    }

    if (!replace) {
      this.#previousPrice = this.#lastPrice;
    }

    this.#lastPrice = price;

    return result;
  }

  protected override calculateSignalState(result?: BandsResult | null) {
    const price = this.#lastPrice;

    if (!result || price === undefined) {
      return TradingSignal.UNKNOWN;
    }

    if (price > result.upper) {
      return TradingSignal.BULLISH;
    }

    if (price < result.lower) {
      return TradingSignal.BEARISH;
    }

    return TradingSignal.SIDEWAYS;
  }
}
