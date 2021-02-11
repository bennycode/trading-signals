import Big, {BigSource} from 'big.js';
import {NotEnoughDataError} from '../error';
import {SimpleIndicator} from '../Indicator';

export abstract class MovingAverage implements SimpleIndicator {
  protected result: Big | undefined;

  constructor(public readonly interval: number) {}

  get isStable(): boolean {
    return !!this.result;
  }

  getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }
    return this.result;
  }

  abstract update(price: BigSource): void;
}
