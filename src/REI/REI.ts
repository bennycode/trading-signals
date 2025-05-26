import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
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

  constructor(public readonly interval: number) {
    super();
  }

  update(candle: HighLowClose, replace: boolean) {
    const range = new Big(candle.high).minus(candle.low);

    if (replace) {
      this.ranges.pop();
    }

    this.ranges.push(range);

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

    const averagePreviousRange = sumOfPreviousRanges.div(this.interval);

    const rei = currentRange.div(averagePreviousRange).times(100);

    return this.setResult(rei, replace);
  }
}

export class FasterREI extends NumberIndicatorSeries<HighLowClose<number>> {
  private readonly ranges: number[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const range = candle.high - candle.low;

    if (replace) {
      this.ranges.pop();
    }

    this.ranges.push(range);

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

    const averagePreviousRange = sumOfPreviousRanges / this.interval;

    const rei = (currentRange / averagePreviousRange) * 100;

    return this.setResult(rei, replace);
  }
}
