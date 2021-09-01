import Big, {BigSource} from 'big.js';
import {MovingAverage} from '../MA/MovingAverage';
import {NotEnoughDataError} from '../error';
import {SMA} from '../SMA/SMA';

/**
 * John Welles Wilder Jr.'s Moving Average (RMA): The calculation is similar to Exponential Moving Averages with the
 * difference that a smoothing factor of 1/interval is being used which makes it respond more slowly to price changes.
 */
export class RMA extends MovingAverage {
  private readonly underlying: SMA;
  private readonly smoothing: Big;

  constructor(public readonly interval: number) {
    super(interval);
    this.underlying = new SMA(interval);
    this.smoothing = new Big(1).div(this.interval);
  }

  update(price: BigSource): Big | void {
    const sma = this.underlying.update(price);

    if (this.result) {
      const smoothed = new Big(price).minus(this.result).mul(this.smoothing);
      return this.setResult(smoothed.plus(this.result));
    } else if (!this.result && sma) {
      return this.setResult(sma);
    }
  }

  override getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  override get isStable(): boolean {
    try {
      this.getResult();
      return true;
    } catch {
      return false;
    }
  }
}
