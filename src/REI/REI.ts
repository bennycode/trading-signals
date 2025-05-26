import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import type {BigSource} from 'big.js';
import Big from 'big.js';
import type {HighLowClose} from '../util/HighLowClose.js';

/**
 * Range Expansion Index (REI)
 * Type: Volatility
 *
 * The Range Expansion Index (REI) is a volatility indicator developed by Thomas DeMark that compares
 * the current day's range to the average range over a given period. It quantifies whether the current
 * price range represents a contraction or expansion compared to the average.
 *
 * - REI > 100: Above average volatility (range expansion)
 * - REI = 100: Average volatility
 * - REI < 100: Below average volatility (range contraction)
 *
 * High REI values often signal potential reversal points as they represent unsustainable volatility expansion.
 *
 * @see https://en.wikipedia.org/wiki/Range_expansion_index
 * @see https://www.quantifiedstrategies.com/range-expansion-index/
 */
export class REI extends BigIndicatorSeries<HighLowClose> {
  private readonly ranges: Big[] = [];
  private readonly multiplier = new Big(100);

  constructor(public readonly interval: number) {
    super();
  }

  update(candle: HighLowClose, replace: boolean) {
    const range = new Big(candle.high).minus(candle.low);

    if (replace && this.ranges.length > 0) {
      // Replace the latest range
      this.ranges[this.ranges.length - 1] = range;
    } else {
      // Add new range
      this.ranges.push(range);
    }

    // Keep only the most recent ranges needed for calculation (interval + 1)
    while (this.ranges.length > this.interval + 1) {
      this.ranges.shift();
    }

    // Need at least interval + 1 ranges to calculate REI
    if (this.ranges.length <= this.interval) {
      return null;
    }

    // Current range is at the end of the array
    const currentRange = this.ranges[this.ranges.length - 1];
    
    // Calculate sum of previous N ranges (excluding the current range)
    let sumOfPreviousRanges = new Big(0);
    for (let i = 0; i < this.interval; i++) {
      sumOfPreviousRanges = sumOfPreviousRanges.plus(this.ranges[i]);
    }
    
    // Calculate average of previous ranges
    const averagePreviousRange = sumOfPreviousRanges.div(this.interval);
    
    // REI = (Current Range / Average Previous Range) * 100
    const rei = currentRange.div(averagePreviousRange).times(this.multiplier);
    
    return this.setResult(rei, replace);
  }
}

/**
 * Faster implementation of the Range Expansion Index (REI) using primitive numbers
 */
export class FasterREI extends NumberIndicatorSeries<HighLowClose<number>> {
  private readonly ranges: number[] = [];
  private readonly multiplier = 100;

  constructor(public readonly interval: number) {
    super();
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const range = candle.high - candle.low;

    if (replace && this.ranges.length > 0) {
      // Replace the latest range
      this.ranges[this.ranges.length - 1] = range;
    } else {
      // Add new range
      this.ranges.push(range);
    }

    // Keep only the most recent ranges needed for calculation (interval + 1)
    while (this.ranges.length > this.interval + 1) {
      this.ranges.shift();
    }

    // Need at least interval + 1 ranges to calculate REI
    if (this.ranges.length <= this.interval) {
      return null;
    }

    // Current range is at the end of the array
    const currentRange = this.ranges[this.ranges.length - 1];
    
    // Calculate sum of previous N ranges (excluding the current range)
    let sumOfPreviousRanges = 0;
    for (let i = 0; i < this.interval; i++) {
      sumOfPreviousRanges += this.ranges[i];
    }
    
    // Calculate average of previous ranges
    const averagePreviousRange = sumOfPreviousRanges / this.interval;
    
    // REI = (Current Range / Average Previous Range) * 100
    const rei = (currentRange / averagePreviousRange) * this.multiplier;
    
    return this.setResult(rei, replace);
  }
}