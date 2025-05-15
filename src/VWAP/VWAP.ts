import Big from 'big.js';
import {BigIndicatorSeries} from '../Indicator.js';
import type {HighLowCloseVolume} from '../util/HighLowClose.js';

/**
 * Volume-Weighted Average Price (VWAP)
 * Type: Trend
 *
 * The Volume-Weighted Average Price (VWAP) represents the average price a security
 * has traded at throughout the day, weighted by both volume and price.
 *
 * Formula: VWAP = (Sum of (Price × Volume)) / Total Volume
 *
 * @see https://www.investopedia.com/terms/v/vwap.asp
 */
export class VWAP extends BigIndicatorSeries<HighLowCloseVolume> {
  private cumulativeTypicalPriceVolume: Big = new Big(0);
  private cumulativeVolume: Big = new Big(0);
  private lastCandle: HighLowCloseVolume | null = null;

  constructor() {
    super();
  }

  private calculateTypicalPriceVolume(data: HighLowCloseVolume) {
    const high = new Big(data.high);
    const typicalPrice = high.plus(data.low).plus(data.close).div(3);
    return typicalPrice.mul(data.volume);
  }

  override update(candle: HighLowCloseVolume, replace: boolean) {
    if (replace && this.lastCandle !== null) {
      const lastTypicalPriceVolume = this.calculateTypicalPriceVolume(this.lastCandle);
      this.cumulativeTypicalPriceVolume = this.cumulativeTypicalPriceVolume.minus(lastTypicalPriceVolume);
      this.cumulativeVolume = this.cumulativeVolume.minus(this.lastCandle.volume);
    }

    // Cache the latest values for potential future replacement
    this.lastCandle = candle;

    // Add to cumulative values
    const typicalPriceVolume = this.calculateTypicalPriceVolume(candle);
    this.cumulativeTypicalPriceVolume = this.cumulativeTypicalPriceVolume.plus(typicalPriceVolume);
    this.cumulativeVolume = this.cumulativeVolume.plus(candle.volume);

    // Only calculate VWAP if we have volume data
    if (this.cumulativeVolume.gt(0)) {
      const vwap = this.cumulativeTypicalPriceVolume.div(this.cumulativeVolume);
      return this.setResult(vwap, replace);
    }

    return null;
  }
}
