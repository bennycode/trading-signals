import type {BigSource} from 'big.js';
import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import type {HighLowCloseVolume, HighLowCloseNumber} from '../util/HighLowClose.js';

/**
 * Volume-Weighted Average Price (VWAP)
 * Type: Trend
 *
 * The Volume-Weighted Average Price (VWAP) represents the average price a security
 * has traded at throughout the day, weighted by both volume and price. It appears as a
 * single line on intraday charts, similar to a moving average but smoother.
 * VWAP typically resets at the start of every trading session.
 *
 * Formula: VWAP = (Sum of (Price × Volume)) / Total Volume
 *
 * @see https://www.investopedia.com/terms/v/vwap.asp
 */
export class VWAP extends BigIndicatorSeries<HighLowCloseVolume> {
  private cumulativeTypicalPriveVolume: Big = new Big(0);
  private cumulativeVolume: Big = new Big(0);

  constructor() {
    super();
  }

  override update(data: HighLowCloseVolume, replace: boolean): Big | null {
    const high = new Big(data.high);
    const typicalPrice = high.plus(data.low).plus(data.close).div(3);
    const typicalPriceVolume = typicalPrice.mul(data.volume);

    if (replace) {
      // Reset to previous state (not implemented for VWAP as it requires storing all price/volume pairs)
      // For a proper implementation, we would need to store all historical data points
      // Since VWAP is typically reset daily, this is an edge case
      throw new Error('Replace operation is not supported for VWAP. Please reset the indicator instead.');
    } else {
      // Add to cumulative values
      this.cumulativeTypicalPriveVolume = this.cumulativeTypicalPriveVolume.plus(typicalPriceVolume);
      this.cumulativeVolume = this.cumulativeVolume.plus(data.volume);
    }

    // Only calculate VWAP if we have volume data
    if (this.cumulativeVolume.gt(0)) {
      const vwap = this.cumulativeTypicalPriveVolume.div(this.cumulativeVolume);
      return this.setResult(vwap, replace);
    }

    return null;
  }
}

// export class FasterVWAP extends NumberIndicatorSeries<HighLowCloseNumber> {
//   private cumulativeTPV: number = 0; // Cumulative (Typical Price × Volume)
//   private cumulativeVolume: number = 0; // Cumulative Volume

//   /**
//    * Creates a new FasterVWAP instance.
//    */
//   constructor() {
//     super();
//   }

//   /**
//    * Adds a new price and volume data point.
//    *
//    * @param price - The price component (typically the typical price (high + low + close) / 3)
//    * @param volume - The volume component
//    */
//   addPrice(price: number, volume: number): number | null {
//     return this.updatePrice(price, volume, false);
//   }

//   /**
//    * Replaces the last price and volume data point.
//    *
//    * @param price - The price component (typically the typical price (high + low + close) / 3)
//    * @param volume - The volume component
//    */
//   replacePrice(price: number, volume: number): number | null {
//     return this.updatePrice(price, volume, true);
//   }

//   /**
//    * Updates VWAP with a new or replacement price and volume data point.
//    *
//    * @param price - The price component (typically the typical price (high + low + close) / 3)
//    * @param volume - The volume component
//    * @param replace - Whether to replace the last data point or add a new one
//    */
//   updatePrice(price: number, volume: number, replace: boolean): number | null {
//     // Calculate price * volume for this period
//     const typicalPriceVolume = price * volume;

//     if (replace) {
//       // Reset to previous state (not implemented for VWAP as it requires storing all price/volume pairs)
//       throw new Error('Replace operation is not supported for VWAP. Please reset the indicator instead.');
//     } else {
//       // Add to cumulative values
//       this.cumulativeTPV += typicalPriceVolume;
//       this.cumulativeVolume += volume;
//     }

//     // Only calculate VWAP if we have volume data
//     if (this.cumulativeVolume > 0) {
//       const vwap = this.cumulativeTPV / this.cumulativeVolume;
//       return this.setResult(vwap, replace);
//     }

//     return null;
//   }

//   /**
//    * Calculates VWAP using high, low, close prices, and volume.
//    *
//    * @param data - Object containing high, low, close prices, and volume
//    * @param replace - Whether to replace the last data point or add a new one
//    */
//   override update(data: HighLowCloseNumber, replace: boolean): number | null {
//     // Calculate typical price: (high + low + close) / 3
//     const typicalPrice = (data.high + data.low + data.close) / 3;

//     return this.updatePrice(typicalPrice, data.volume, replace);
//   }

//   /**
//    * Adds a new candle data point with high, low, close prices, and volume.
//    */
//   add(data: {high: number; low: number; close: number; volume: number}) {
//     return this.update(data, false);
//   }

//   /**
//    * Replaces the last candle data point.
//    */
//   replace(data: {high: number; low: number; close: number; volume: number}) {
//     return this.update(data, true);
//   }
// }
