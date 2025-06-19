import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
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
    const hlc3 = high.plus(data.low).plus(data.close).div(3);
    return hlc3.mul(data.volume);
  }

  override getRequiredInputs() {
    return 2;
  }

  override update(candle: HighLowCloseVolume, replace: boolean) {
    // Only calculate VWAP if we have volume data
    if (candle.volume === 0) {
      return null;
    }

    if (replace && this.lastCandle !== null) {
      const lastTypicalPriceVolume = this.calculateTypicalPriceVolume(this.lastCandle);
      this.cumulativeTypicalPriceVolume = this.cumulativeTypicalPriceVolume.minus(lastTypicalPriceVolume);
      this.cumulativeVolume = this.cumulativeVolume.minus(this.lastCandle.volume);
    }

    // Cache the latest values for potential future replacement
    this.lastCandle = candle;

    const typicalPriceVolume = this.calculateTypicalPriceVolume(candle);
    this.cumulativeTypicalPriceVolume = this.cumulativeTypicalPriceVolume.plus(typicalPriceVolume);
    this.cumulativeVolume = this.cumulativeVolume.plus(candle.volume);

    const vwap = this.cumulativeTypicalPriceVolume.div(this.cumulativeVolume);
    return this.setResult(vwap, replace);
  }
}

export class FasterVWAP extends NumberIndicatorSeries<HighLowCloseVolume<number>> {
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
