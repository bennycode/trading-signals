import {SimpleIndicator} from '../Indicator';
import Big, {BigSource} from 'big.js';
import {SMA} from '../SMA/SMA';
import {NotEnoughDataError} from '../error';

/**
 * The Awesome Oscillator (AO) is an indicator used to measure market momentum.
 * It has been developed by the technical analyst and charting enthusiast Bill Williams.
 */
export class AO implements SimpleIndicator {
  private result: Big | undefined;
  private readonly shortSMA: SMA;
  private readonly longSMA: SMA;

  constructor(public readonly shortInterval: number, public readonly longInterval: number) {
    this.shortSMA = new SMA(shortInterval);
    this.longSMA = new SMA(longInterval);
  }

  get isStable(): boolean {
    return this.result !== undefined;
  }

  getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  update(low: BigSource, high: BigSource): void {
    const candleSum = new Big(low).add(high);
    const medianPrice = candleSum.div(2);

    this.shortSMA.update(medianPrice);
    this.longSMA.update(medianPrice);

    if (this.shortSMA.isStable && this.longSMA.isStable) {
      this.result = this.shortSMA.getResult().sub(this.longSMA.getResult());
    }
  }
}
