import Big from 'big.js';

export abstract class MovingAverage {
  protected result: Big | undefined;

  constructor(protected readonly interval: number) {}

  getResult(): Big {
    if (!this.result) {
      throw Error('No enough input data');
    }
    return this.result;
  }

  abstract update(price: Big): void;
}
