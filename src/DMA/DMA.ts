import {TechnicalIndicator} from '../Indicator.js';
import type {FasterMovingAverage} from '../MA/MovingAverage.js';
import type {FasterMovingAverageTypes} from '../MA/MovingAverageTypes.js';
import {FasterSMA} from '../SMA/SMA.js';

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
export class FasterDMA extends TechnicalIndicator<FasterDMAResult, number> {
  public readonly short: FasterMovingAverage;
  public readonly long: FasterMovingAverage;

  constructor(short: number, long: number, SmoothingIndicator: FasterMovingAverageTypes = FasterSMA) {
    super();
    this.short = new SmoothingIndicator(short);
    this.long = new SmoothingIndicator(long);
  }

  override get isStable(): boolean {
    return this.long.isStable;
  }

  override getRequiredInputs() {
    return this.long.getRequiredInputs();
  }

  update(price: number, replace: boolean) {
    this.short.update(price, replace);
    this.long.update(price, replace);

    if (this.isStable) {
      return (this.result = {
        long: this.long.getResultOrThrow(),
        short: this.short.getResultOrThrow(),
      });
    }

    return null;
  }
}
