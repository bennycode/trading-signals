import {SimpleIndicator} from '../Indicator';
import Big, {BigSource} from 'big.js';
import {NotEnoughDataError} from '../../dist';

/**
 * Implementation of the Center of Gravity (CG) oscillator by John Ehlers.
 *
 * @note According to the specification, the price inputs shall be calculated the following way:
 * ((High Price + Low Price) / 2)
 * @note The selected interval should be half the dominant cycle length
 * @note If the interval gets too short, the CG oscillator loses its smoothing and gets a little too nervous for profitable trading
 * @see http://www.mesasoftware.com/papers/TheCGOscillator.pdf
 */
export class CG implements SimpleIndicator {
  private readonly prices: Big[] = [];

  get isStable(): boolean {
    return this.prices.length >= this.interval;
  }

  constructor(public readonly interval: number) {}

  update(price: BigSource): void {
    this.prices.push(new Big(price));

    if (this.prices.length > this.interval) {
      this.prices.shift();
    }
  }

  getResult(): Big {
    if (!this.isStable) {
      throw new NotEnoughDataError();
    }

    let nominator = new Big(0);
    let denominator = new Big(0);

    for (let i = 0; i < this.prices.length; ++i) {
      const price = this.prices[i];
      nominator = nominator.plus(price.mul(i + 1));
      denominator = denominator.plus(price);
    }

    if (denominator.gt(0)) {
      return nominator.mul(-1).div(denominator);
    }
    return new Big(0);
  }
}
