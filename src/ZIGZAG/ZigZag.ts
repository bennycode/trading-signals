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
  private readonly pivotLookback: number;

  private readonly highBuffer: Big[] = [];
  private readonly lowBuffer: Big[] = [];
  private readonly candles: HighLow[] = [];

  private lastConfirmed: {index: number; value: Big; type: 'LH' | 'LL' | 'HH' | 'HL'} | null = null;

  constructor(config: {deviation: number; pivotLookback: number}) {
    super();
    this.pivotLookback = config.pivotLookback; // e.g. 5 bars before & after
  }

  override getRequiredInputs() {
    return 1;
  }

  update(candle: HighLow, replace: boolean): Big | null {
    const high = new Big(candle.high);
    const low = new Big(candle.low);
    this.candles.push(candle);
    this.highBuffer.push(high);
    this.lowBuffer.push(low);

    const i = this.candles.length - 1;

    // Need enough data to evaluate pivot
    if (i < this.pivotLookback || i >= this.candles.length - this.pivotLookback) {
      return null;
    }

    const pivotRange = this.candles.slice(i - this.pivotLookback, i + this.pivotLookback + 1);
    const candidate = this.candles[i];

    const candidateHigh = new Big(candidate.high);
    const candidateLow = new Big(candidate.low);

    const isHighPivot = pivotRange.every(c => candidateHigh.gte(c.high));
    const isLowPivot = pivotRange.every(c => candidateLow.lte(c.low));

    if (isHighPivot) {
      if (
        !this.lastConfirmed ||
        candidateHigh.lt(this.lastConfirmed.value) ||
        (this.lastConfirmed.type === 'HL' && candidateHigh.gt(this.lastConfirmed.value))
      ) {
        const label = this.lastConfirmed?.type === 'HL' && candidateHigh.gt(this.lastConfirmed.value) ? 'HH' : 'LH';
        this.lastConfirmed = {index: i, type: label, value: candidateHigh};
        return this.setResult(candidateHigh, replace);
      }
    }

    if (isLowPivot) {
      if (
        !this.lastConfirmed ||
        candidateLow.lt(this.lastConfirmed.value) ||
        (this.lastConfirmed.type === 'LH' && candidateLow.gt(this.lastConfirmed.value))
      ) {
        const label = this.lastConfirmed?.type === 'LH' && candidateLow.gt(this.lastConfirmed.value) ? 'HL' : 'LL';
        this.lastConfirmed = {index: i, type: label, value: candidateLow};
        return this.setResult(candidateLow, replace);
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
