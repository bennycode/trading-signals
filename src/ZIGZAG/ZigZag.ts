import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import type {HighLow} from '../util/HighLowClose.js';
import Big from 'big.js';

export type ZigZagConfig = {
  /**
   * Deviation percentage threshold (e.g., 0.05 for 5%)
   * Minimum price change required to confirm a new extreme point
   */
  deviation: number;
};

/**
 * ZigZag Pattern Indicator
 * Type: Trend/Pattern
 *
 * The ZigZag indicator filters out market noise by using a deviation threshold.
 * It only acknowledges a new swing point when the price moves by a minimum
 * deviation amount from the previous significant high or low.
 *
 * The indicator alternates between tracking highs and lows: after confirming
 * a high, it searches for a significant low, and after confirming a low, it
 * searches for a significant high.
 *
 * When an extreme point is found, the indicator returns the value of this
 * extreme point. For all other inputs, it returns null.
 *
 * @see https://www.investopedia.com/terms/z/zigzag.asp
 */
export class ZigZag extends BigIndicatorSeries<HighLow> {
  private readonly deviationThreshold: Big;
  private isLookingForHigh: boolean = true;
  private lastExtreme: Big | null = null;
  private pendingHigh: Big | null = null;
  private pendingLow: Big | null = null;

  constructor(config: ZigZagConfig) {
    super();
    this.deviationThreshold = new Big(config.deviation);

    if (this.deviationThreshold.lte(0)) {
      throw new Error('Deviation must be greater than 0');
    }
  }

  override getRequiredInputs() {
    return 1;
  }

  update(candle: HighLow, replace: boolean): Big | null {
    const high = new Big(candle.high);
    const low = new Big(candle.low);

    // Initialize on first candle
    if (this.lastExtreme === null) {
      this.lastExtreme = high;
      this.pendingHigh = high;
      this.pendingLow = low;
      this.isLookingForHigh = true; // Start looking for higher highs
      return this.setResult(high, replace);
    }

    let newExtreme: Big | null = null;

    if (this.isLookingForHigh) {
      // Update pending high if we have a higher high
      if (this.pendingHigh === null || high.gt(this.pendingHigh)) {
        this.pendingHigh = high;
      }

      // Check if we have a significant low (reversal from current pending high)
      if (this.pendingHigh !== null) {
        const deviationFromHigh = this.pendingHigh.minus(low).div(this.pendingHigh);

        if (deviationFromHigh.gte(this.deviationThreshold)) {
          // Confirm the pending high as the new extreme
          newExtreme = this.pendingHigh;
          this.lastExtreme = this.pendingHigh;
          this.isLookingForHigh = false;
          this.pendingLow = low; // Start tracking from current low
          this.pendingHigh = null;
        }
      }
    } else {
      // Looking for low
      // Update pending low if we have a lower low
      if (this.pendingLow === null || low.lt(this.pendingLow)) {
        this.pendingLow = low;
      }

      // Check if we have a significant high (reversal from current pending low)
      if (this.pendingLow !== null) {
        const deviationFromLow = high.minus(this.pendingLow).div(this.pendingLow);

        if (deviationFromLow.gte(this.deviationThreshold)) {
          // Confirm the pending low as the new extreme
          newExtreme = this.pendingLow;
          this.lastExtreme = this.pendingLow;
          this.isLookingForHigh = true;
          this.pendingHigh = high; // Start tracking from current high
          this.pendingLow = null;
        }
      }
    }

    if (newExtreme !== null) {
      return this.setResult(newExtreme, replace);
    }

    return null;
  }
}

/**
 * ZigZag Pattern Indicator (Faster Version)
 * Type: Trend/Pattern
 * 
 * Number-based implementation for better performance.
 */
export class FasterZigZag extends NumberIndicatorSeries<HighLow<number>> {
  private readonly deviationThreshold: number;
  private isLookingForHigh: boolean = true;
  private lastExtreme: number | null = null;
  private pendingHigh: number | null = null;
  private pendingLow: number | null = null;

  constructor(config: ZigZagConfig) {
    super();
    this.deviationThreshold = config.deviation;

    if (this.deviationThreshold <= 0) {
      throw new Error('Deviation must be greater than 0');
    }
  }

  override getRequiredInputs() {
    return 1;
  }

  update(candle: HighLow<number>, replace: boolean): number | null {
    const {high, low} = candle;

    // Initialize on first candle
    if (this.lastExtreme === null) {
      this.lastExtreme = high;
      this.pendingHigh = high;
      this.pendingLow = low;
      this.isLookingForHigh = true; // Start looking for higher highs
      return this.setResult(high, replace);
    }

    let newExtreme: number | null = null;

    if (this.isLookingForHigh) {
      // Update pending high if we have a higher high
      if (this.pendingHigh === null || high > this.pendingHigh) {
        this.pendingHigh = high;
      }

      // Check if we have a significant low (reversal from current pending high)
      if (this.pendingHigh !== null) {
        const deviationFromHigh = (this.pendingHigh - low) / this.pendingHigh;

        if (deviationFromHigh >= this.deviationThreshold) {
          // Confirm the pending high as the new extreme
          newExtreme = this.pendingHigh;
          this.lastExtreme = this.pendingHigh;
          this.isLookingForHigh = false;
          this.pendingLow = low; // Start tracking from current low
          this.pendingHigh = null;
        }
      }
    } else {
      // Looking for low
      // Update pending low if we have a lower low
      if (this.pendingLow === null || low < this.pendingLow) {
        this.pendingLow = low;
      }

      // Check if we have a significant high (reversal from current pending low)
      if (this.pendingLow !== null) {
        const deviationFromLow = (high - this.pendingLow) / this.pendingLow;

        if (deviationFromLow >= this.deviationThreshold) {
          // Confirm the pending low as the new extreme
          newExtreme = this.pendingLow;
          this.lastExtreme = this.pendingLow;
          this.isLookingForHigh = true;
          this.pendingHigh = high; // Start tracking from current high
          this.pendingLow = null;
        }
      }
    }

    if (newExtreme !== null) {
      return this.setResult(newExtreme, replace);
    }

    return null;
  }
}