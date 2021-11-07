import {BigIndicatorSeries} from '../Indicator';
import Big, {BigSource} from 'big.js';
import {SMA} from '../SMA/SMA';
import {NotEnoughDataError} from '../error';

/**
 * Awesome Oscillator (AO)
 * Type: Momentum
 *
 * The Awesome Oscillator (AO) is an indicator used to measure market momentum.
 * It has been developed by the technical analyst and charting enthusiast Bill Williams.
 *
 * When AO crosses above Zero, short term momentum is rising faster than long term momentum which signals a bullish buying opportunity.
 * When AO crosses below Zero, short term momentum is falling faster then the long term momentum which signals a bearish selling opportunity.
 *
 * @see https://www.tradingview.com/support/solutions/43000501826-awesome-oscillator-ao/
 * @see https://tradingstrategyguides.com/bill-williams-awesome-oscillator-strategy/
 */
export class AO extends BigIndicatorSeries {
  public readonly long: SMA;
  public readonly short: SMA;

  constructor(public readonly shortInterval: number, public readonly longInterval: number) {
    super();
    this.short = new SMA(shortInterval);
    this.long = new SMA(longInterval);
  }

  override get isStable(): boolean {
    return this.result !== undefined;
  }

  override getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  override update(low: BigSource, high: BigSource): void | Big {
    const candleSum = new Big(low).add(high);
    const medianPrice = candleSum.div(2);

    this.short.update(medianPrice);
    this.long.update(medianPrice);

    if (this.short.isStable && this.long.isStable) {
      const result = this.setResult(this.short.getResult().sub(this.long.getResult()));
      return result;
    }
  }
}
