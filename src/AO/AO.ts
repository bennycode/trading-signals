import {IndicatorSeries} from '../Indicator.js';
import type {FasterMovingAverage} from '../MA/MovingAverage.js';
import type {FasterMovingAverageTypes} from '../MA/MovingAverageTypes.js';
import {FasterSMA} from '../SMA/SMA.js';
import type {HighLow} from '../util/index.js';

/**
 * Awesome Oscillator (AO)
 * Type: Momentum
 *
 * The Awesome Oscillator (AO) is an indicator used to measure market momentum.
 * It has been developed by the technical analyst and charting enthusiast Bill Williams.
 *
 * When AO crosses above Zero, short term momentum is rising faster than long term momentum which signals a bullish
 * buying opportunity. When AO crosses below Zero, short term momentum is falling faster then the long term momentum
 * which signals a bearish selling opportunity.
 *
 * @see https://www.tradingview.com/support/solutions/43000501826-awesome-oscillator-ao/
 * @see https://tradingstrategyguides.com/bill-williams-awesome-oscillator-strategy/
 */
export class FasterAO extends IndicatorSeries<HighLow<number>> {
  public readonly long: FasterMovingAverage;
  public readonly short: FasterMovingAverage;

  constructor(
    public readonly shortInterval: number,
    public readonly longInterval: number,
    SmoothingIndicator: FasterMovingAverageTypes = FasterSMA
  ) {
    super();
    this.short = new SmoothingIndicator(shortInterval);
    this.long = new SmoothingIndicator(longInterval);
  }

  override getRequiredInputs() {
    return this.long.getRequiredInputs();
  }

  update({low, high}: HighLow<number>, replace: boolean) {
    const medianPrice = (low + high) / 2;

    this.short.update(medianPrice, replace);
    this.long.update(medianPrice, replace);

    if (this.long.isStable) {
      return this.setResult(this.short.getResultOrThrow() - this.long.getResultOrThrow(), replace);
    }

    return null;
  }
}
