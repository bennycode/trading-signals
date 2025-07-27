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
  private isLookingForHigh: boolean = false; // Start looking for low after first high
  private lastConfirmedExtreme: Big | null = null;
  private currentCandidateHigh: Big | null = null;
  private currentCandidateLow: Big | null = null;

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
    if (this.lastConfirmedExtreme === null) {
      this.lastConfirmedExtreme = high;
      this.currentCandidateLow = low;
      this.isLookingForHigh = false; // Start looking for a significant low
      return this.setResult(high, replace);
    }

    if (this.isLookingForHigh) {
      // We're looking for a high after confirming a low
      // Track the highest high since the last confirmed low
      if (this.currentCandidateHigh === null || high.gt(this.currentCandidateHigh)) {
        this.currentCandidateHigh = high;
      }

      // Check if we have a significant drop from the candidate high to trigger confirmation
      if (this.currentCandidateHigh !== null) {
        const deviationFromCandidateHigh = this.currentCandidateHigh.minus(low).div(this.currentCandidateHigh);
        if (deviationFromCandidateHigh.gte(this.deviationThreshold)) {
          // Confirm the candidate high as the new extreme
          const confirmedHigh = this.currentCandidateHigh;
          this.lastConfirmedExtreme = confirmedHigh;
          this.currentCandidateLow = low;
          this.currentCandidateHigh = null;
          this.isLookingForHigh = false;
          return this.setResult(confirmedHigh, replace);
        }
      }
    } else {
      // We're looking for a low after confirming a high
      // Track the lowest low since the last confirmed high
      if (this.currentCandidateLow === null || low.lt(this.currentCandidateLow)) {
        this.currentCandidateLow = low;
      }

      // Check if we have a significant rise from the candidate low to trigger confirmation
      if (this.currentCandidateLow !== null) {
        const deviationFromCandidateLow = high.minus(this.currentCandidateLow).div(this.currentCandidateLow);
        if (deviationFromCandidateLow.gte(this.deviationThreshold)) {
          // Confirm the candidate low as the new extreme
          const confirmedLow = this.currentCandidateLow;
          this.lastConfirmedExtreme = confirmedLow;
          this.currentCandidateHigh = high;
          this.currentCandidateLow = null;
          this.isLookingForHigh = true;
          return this.setResult(confirmedLow, replace);
        }
      }
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
  private isLookingForHigh: boolean = false; // Start looking for low after first high
  private lastConfirmedExtreme: number | null = null;
  private currentCandidateHigh: number | null = null;
  private currentCandidateLow: number | null = null;

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
    if (this.lastConfirmedExtreme === null) {
      this.lastConfirmedExtreme = high;
      this.currentCandidateLow = low;
      this.isLookingForHigh = false; // Start looking for a significant low
      return this.setResult(high, replace);
    }

    if (this.isLookingForHigh) {
      // We're looking for a high after confirming a low
      // Track the highest high since the last confirmed low
      if (this.currentCandidateHigh === null || high > this.currentCandidateHigh) {
        this.currentCandidateHigh = high;
      }

      // Check if we have a significant drop from the candidate high to trigger confirmation
      if (this.currentCandidateHigh !== null) {
        const deviationFromCandidateHigh = (this.currentCandidateHigh - low) / this.currentCandidateHigh;
        if (deviationFromCandidateHigh >= this.deviationThreshold) {
          // Confirm the candidate high as the new extreme
          const confirmedHigh = this.currentCandidateHigh;
          this.lastConfirmedExtreme = confirmedHigh;
          this.currentCandidateLow = low;
          this.currentCandidateHigh = null;
          this.isLookingForHigh = false;
          return this.setResult(confirmedHigh, replace);
        }
      }
    } else {
      // We're looking for a low after confirming a high
      // Track the lowest low since the last confirmed high
      if (this.currentCandidateLow === null || low < this.currentCandidateLow) {
        this.currentCandidateLow = low;
      }

      // Check if we have a significant rise from the candidate low to trigger confirmation
      if (this.currentCandidateLow !== null) {
        const deviationFromCandidateLow = (high - this.currentCandidateLow) / this.currentCandidateLow;
        if (deviationFromCandidateLow >= this.deviationThreshold) {
          // Confirm the candidate low as the new extreme
          const confirmedLow = this.currentCandidateLow;
          this.lastConfirmedExtreme = confirmedLow;
          this.currentCandidateHigh = high;
          this.currentCandidateLow = null;
          this.isLookingForHigh = true;
          return this.setResult(confirmedLow, replace);
        }
      }
    }

    return null;
  }
}