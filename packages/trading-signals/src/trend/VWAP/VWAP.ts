import {IndicatorSeries} from '../../types/Indicator.js';
import type {HighLowCloseVolume} from '../../types/HighLowClose.js';

/**
 * Volume-Weighted Average Price (VWAP)
 * Type: Trend
 *
 * The Volume-Weighted Average Price (VWAP) represents the average price a security has traded at throughout the day, weighted by both volume and price.
 *
 * Formula: VWAP = (Sum of (Price × Volume)) / Total Volume
 *
 * @see https://www.investopedia.com/terms/v/vwap.asp
 */
export class VWAP extends IndicatorSeries<HighLowCloseVolume<number>> {
  private cumulativeTypicalPriceVolume: number = 0;
  private cumulativeVolume: number = 0;
  private lastCandle: HighLowCloseVolume<number> | null = null;

  constructor() {
    super();
  }

  private calculateTypicalPriceVolume(data: HighLowCloseVolume<number>) {
    const hlc3 = (data.high + data.low + data.close) / 3;
    return hlc3 * data.volume;
  }

  override getRequiredInputs() {
    return 2;
  }

  override update(candle: HighLowCloseVolume<number>, replace: boolean) {
    // Only calculate VWAP if we have volume data
    if (candle.volume === 0) {
      return null;
    }

    if (replace && this.lastCandle !== null) {
      const lastTypicalPriceVolume = this.calculateTypicalPriceVolume(this.lastCandle);
      this.cumulativeTypicalPriceVolume = this.cumulativeTypicalPriceVolume - lastTypicalPriceVolume;
      this.cumulativeVolume = this.cumulativeVolume - this.lastCandle.volume;
    }

    // Cache the latest values for potential future replacement
    this.lastCandle = candle;

    const typicalPriceVolume = this.calculateTypicalPriceVolume(candle);
    this.cumulativeTypicalPriceVolume = this.cumulativeTypicalPriceVolume + typicalPriceVolume;
    this.cumulativeVolume = this.cumulativeVolume + candle.volume;

    const vwap = this.cumulativeTypicalPriceVolume / this.cumulativeVolume;
    return this.setResult(vwap, replace);
  }
}
