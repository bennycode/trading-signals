import {BigIndicatorSeries} from '../Indicator';
import Big, {BigSource} from 'big.js';
import {SMA} from '../SMA/SMA';
import {NotEnoughDataError} from '../error';

/**
 * Center of Gravity (CG)
 * Type: Trend
 *
 * Implementation of the Center of Gravity (CG) oscillator by John Ehlers.
 *
 * @note According to the specification, the price inputs shall be calculated the following way:
 * ((High Price + Low Price) / 2)
 * @note The selected interval should be half the dominant cycle length (signal line)
 * @note If the interval gets too short, the CG oscillator loses its smoothing and gets a little too nervous for
 *   profitable trading
 * @see http://www.mesasoftware.com/papers/TheCGOscillator.pdf
 */
export class CG extends BigIndicatorSeries {
  public signal: SMA;

  public readonly prices: Big[] = [];

  override get isStable(): boolean {
    return this.prices.length >= this.interval && this.signal.isStable;
  }

  constructor(public readonly interval: number, public readonly signalInterval: number) {
    super();
    this.signal = new SMA(signalInterval);
  }

  override update(price: BigSource): Big {
    this.prices.push(new Big(price));

    if (this.prices.length > this.interval) {
      this.prices.shift();
    }

    let nominator = new Big(0);
    let denominator = new Big(0);

    for (let i = 0; i < this.prices.length; ++i) {
      const price = this.prices[i];
      nominator = nominator.plus(price.mul(i + 1));
      denominator = denominator.plus(price);
    }

    const cg = denominator.gt(0) ? nominator.div(denominator) : new Big(0);

    this.signal.update(cg);

    return this.setResult(cg);
  }

  override getResult(): Big {
    if (!this.isStable || !this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }
}
