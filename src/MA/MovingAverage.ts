import Big, {BigSource} from 'big.js';
import {NotEnoughDataError} from '../error';
import {SimpleIndicator} from '../Indicator';

export abstract class MovingAverage extends SimpleIndicator {
  constructor(public readonly interval: number) {
    super();
  }

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
