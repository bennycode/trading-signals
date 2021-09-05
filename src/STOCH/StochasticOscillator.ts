import {Indicator} from '../Indicator';
import Big from 'big.js';
import {SMA} from '../SMA/SMA';
import {ATRCandle} from '../ATR/ATR';

export interface StochasticResult {
  d: Big;
  k: Big;
}

/**
 * The stochastic oscillator is a momentum indicator developed by George Lane in the late 1950s.
 * - the %k period n
 - the %k slowing period m
 - the %d period p

 k: is a Simple Moving Average of period m (slow) applied to fastk
 d: is a Simple Moving Average of period p (long) applied to %k

 * @see https://en.wikipedia.org/wiki/Stochastic_oscillator
 * @see https://tulipindicators.org/stoch
 */
export class StochasticOscillator implements Indicator<StochasticResult> {
  isStable: boolean = false;

  public readonly short: SMA;
  public readonly long: SMA;

  constructor(
    public readonly interval: number,
    public readonly shortSmaInterval: number,
    public readonly longSmaInterval: number
  ) {
    this.short = new SMA(shortSmaInterval);
    this.long = new SMA(longSmaInterval);
  }

  getResult(): StochasticResult {
    return this.isStable ? {k: new Big(0), d: new Big(0)} : {k: new Big(1), d: new Big(1)};
  }

  update({high, low, close}: ATRCandle): void {
    const test = new Big(high).plus(low).plus(close);
    if (test.gt(0)) {
      this.isStable = true;
    }
  }
}
