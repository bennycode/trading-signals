import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import type {OpenHighLowCloseVolume} from '../util/HighLowClose.js';
import {pushUpdate} from '../util/pushUpdate.js';

/**
 * On-Balance Volume (OBV)
 * Type: Momentum
 *
 * On-balance volume (OBV) is a technical trading momentum indicator that uses volume flow to predict changes in stock
 * price. Joseph Granville first developed the OBV metric in the 1963 book Granville's New Key to Stock Market Profits.
 *
 * @see https://www.investopedia.com/terms/o/onbalancevolume.asp
 */
export class OBV extends BigIndicatorSeries<OpenHighLowCloseVolume> {
  public readonly candles: OpenHighLowCloseVolume[] = [];

  override getRequiredInputs() {
    return 2;
  }

  update(candle: OpenHighLowCloseVolume, replace: boolean) {
    pushUpdate(this.candles, replace, candle, 2);

    if (this.candles.length === 1) {
      return null;
    }

    const prevCandle = this.candles[this.candles.length - 2];
    const prevPrice = prevCandle.close;
    const prevResult = this.result ?? new Big(0);
    const currentPrice = new Big(candle.close);
    const nextResult = currentPrice.gt(prevPrice) ? candle.volume : currentPrice.lt(prevPrice) ? -candle.volume : 0;

    return this.setResult(prevResult.add(nextResult), replace);
  }
}

export class FasterOBV extends NumberIndicatorSeries<OpenHighLowCloseVolume<number>> {
  public readonly candles: OpenHighLowCloseVolume<number>[] = [];

  override getRequiredInputs() {
    return 2;
  }

  update(candle: OpenHighLowCloseVolume<number>, replace: boolean) {
    pushUpdate(this.candles, replace, candle, 2);

    if (this.candles.length === 1) {
      return null;
    }

    const prevCandle = this.candles[this.candles.length - 2];
    const prevPrice = prevCandle.close;
    const prevResult = this.result ?? 0;
    const currentPrice = candle.close;
    const nextResult = currentPrice > prevPrice ? candle.volume : currentPrice < prevPrice ? -candle.volume : 0;

    return this.setResult(prevResult + nextResult, false);
  }
}
