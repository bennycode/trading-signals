import Big, {BigSource} from 'big.js';
import {MovingAverage, MovingAverageTypeContext, SMA} from '..';
import {Indicator} from '../Indicator';

export type DMAResult = {long: Big; short: Big};

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
  public readonly long: MovingAverage;
  public readonly short: MovingAverage;
  private received: number = 0;

  constructor(short: number, long: number, Indicator: MovingAverageTypeContext = SMA) {
    this.short = new Indicator(short);
    this.long = new Indicator(long);
  }

  get isStable(): boolean {
    return this.received >= this.long.interval;
  }

  update(price: BigSource): void {
    this.short.update(price);
    this.long.update(price);
    this.received += 1;
  }

  getResult(): DMAResult {
    return {
      long: this.long.getResult(),
      short: this.short.getResult(),
    };
  }
}
