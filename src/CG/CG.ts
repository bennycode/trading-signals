import type {BigSource} from 'big.js';
import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import {FasterSMA, SMA} from '../SMA/SMA.js';
import {pushUpdate} from '../util/pushUpdate.js';

/**
 * Center of Gravity (CG)
 * Type: Momentum
 *
 * Implementation of the Center of Gravity (CG) oscillator by John Ehlers. The Center of Gravity (CG) aims to identify turning points in price action with minimal lag (leading indicator). Peaks and troughs in CG can precede actual price highs and lows. The CG is often paired with its own signal line for entry/exit triggers.
 *
 * Interpretation:
 * Crossing the zero line may suggest a shift in trend.
 *
 * Note:
 * - According to the specification, the price inputs shall be calculated the following way:
 * ((High Price + Low Price) / 2)
 * - The selected interval should be half the dominant cycle length (signal line)
 * - If the interval gets too short, the CG oscillator loses its smoothing and gets a little too nervous for
 *   profitable trading
 * @see http://www.mesasoftware.com/papers/TheCGOscillator.pdf
 */
export class CG extends BigIndicatorSeries {
  public signal: SMA;
  public readonly prices: Big[] = [];

  override get isStable(): boolean {
    return this.signal.isStable;
  }

  constructor(
    public readonly interval: number,
    public readonly signalInterval: number
  ) {
    super();
    this.signal = new SMA(signalInterval);
  }

  override getRequiredInputs() {
    return this.signal.getRequiredInputs();
  }

  update(price: BigSource, replace: boolean) {
    pushUpdate(this.prices, replace, new Big(price), this.interval);

    let nominator = new Big(0);
    let denominator = new Big(0);

    for (let i = 0; i < this.prices.length; ++i) {
      const price = this.prices[i];
      nominator = nominator.plus(price.mul(i + 1));
      denominator = denominator.plus(price);
    }

    const cg = denominator.gt(0) ? nominator.div(denominator) : new Big(0);

    this.signal.update(cg, replace);

    if (this.signal.isStable) {
      return this.setResult(cg, replace);
    }

    return null;
  }
}

export class FasterCG extends NumberIndicatorSeries {
  public signal: FasterSMA;

  public readonly prices: number[] = [];

  override get isStable(): boolean {
    return this.signal.isStable;
  }

  constructor(
    public readonly interval: number,
    public readonly signalInterval: number
  ) {
    super();
    this.signal = new FasterSMA(signalInterval);
  }

  override getRequiredInputs() {
    return this.signal.getRequiredInputs();
  }

  update(price: number, replace: boolean) {
    pushUpdate(this.prices, replace, price, this.interval);

    let nominator = 0;
    let denominator = 0;

    for (let i = 0; i < this.prices.length; ++i) {
      const price = this.prices[i];
      nominator = nominator + price * (i + 1);
      denominator = denominator + price;
    }

    const cg = denominator > 0 ? nominator / denominator : 0;

    this.signal.update(cg, replace);

    if (this.signal.isStable) {
      return this.setResult(cg, replace);
    }

    return null;
  }
}
