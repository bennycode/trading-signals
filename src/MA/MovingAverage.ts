import Big, {BigSource} from 'big.js';
import {NotEnoughDataError} from '../error';

export abstract class MovingAverage {
  protected result: Big | undefined;

  constructor(protected readonly interval: number) {}

  getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }
    return this.result;
  }

  abstract update(price: BigSource): void;
}
