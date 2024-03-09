import {Big, BigSource} from '../index.js';
import {Indicator} from '../Indicator.js';
import {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage.js';
import {FasterMovingAverageTypes, MovingAverageTypes} from '../MA/MovingAverageTypes.js';
import {FasterSMA, SMA} from '../SMA/SMA.js';

export type DMAResult = {long: Big; short: Big};

export interface FasterDMAResult {
  long: number;
  short: number;
}

/**
 * Dual Moving Average (DMA)
 * Type: Trend
 *
 * The DMA consists of two moving averages: Short-term & long-term.
 *
 * Dual Moving Average Crossover:
 * A short-term MA crossing above a long-term MA indicates a bullish buying opportunity.
 * A short-term MA crossing below a long-term MA indicates a bearish selling opportunity.
 *
 * @see https://faculty.fuqua.duke.edu/~charvey/Teaching/BA453_2002/CCAM/CCAM.htm#_Toc2634228
 */
export class DMA implements Indicator<DMAResult> {
  public readonly short: MovingAverage;
  public readonly long: MovingAverage;

  constructor(short: number, long: number, Indicator: MovingAverageTypes = SMA) {
    this.short = new Indicator(short);
    this.long = new Indicator(long);
  }

  get isStable(): boolean {
    return this.long.isStable;
  }

  update(price: BigSource, replace: boolean = false): void {
    this.short.update(price, replace);
    this.long.update(price, replace);
  }

  getResult(): DMAResult {
    return {
      long: this.long.getResult(),
      short: this.short.getResult(),
    };
  }
}

export class FasterDMA implements Indicator<FasterDMAResult, number> {
  public readonly short: FasterMovingAverage;
  public readonly long: FasterMovingAverage;

  constructor(short: number, long: number, SmoothingIndicator: FasterMovingAverageTypes = FasterSMA) {
    this.short = new SmoothingIndicator(short);
    this.long = new SmoothingIndicator(long);
  }

  get isStable(): boolean {
    return this.long.isStable;
  }

  update(price: number, replace: boolean = false): void {
    this.short.update(price, replace);
    this.long.update(price, replace);
  }

  getResult(): FasterDMAResult {
    return {
      long: this.long.getResult(),
      short: this.short.getResult(),
    };
  }
}
