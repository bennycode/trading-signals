import {TechnicalIndicator} from '../../types/Indicator.js';
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
export class BollingerBands extends TechnicalIndicator<BandsResult, number> {
  public readonly prices: number[] = [];

  constructor(
    public readonly interval: number,
    public readonly deviationMultiplier: number = 2
  ) {
    super();
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    const dropOut = pushUpdate(this.prices, replace, price, this.interval);

    if (dropOut) {
      const middle = getAverage(this.prices);
      const standardDeviation = getStandardDeviation(this.prices, middle);

      return (this.result = {
        lower: middle - standardDeviation * this.deviationMultiplier,
        middle,
        upper: middle + standardDeviation * this.deviationMultiplier,
      });
    }

    return null;
  }
}
