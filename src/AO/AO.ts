import {SimpleIndicator} from '../Indicator';
import Big, {BigSource} from 'big.js';
import {SMA} from '../SMA/SMA';
import {NotEnoughDataError} from '../error';

/**
 * The Awesome Oscillator (AO) is an indicator used to measure market momentum.
 * It has been developed by the technical analyst and charting enthusiast Bill Williams.
 */
export class AO extends SimpleIndicator {
  public readonly long: SMA;
  public readonly short: SMA;

  constructor(public readonly shortInterval: number, public readonly longInterval: number) {
    super();
    this.short = new SMA(shortInterval);
    this.long = new SMA(longInterval);
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

  update(low: BigSource, high: BigSource): void | Big {
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
