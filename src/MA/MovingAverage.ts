import Big, {BigSource} from 'big.js';

export abstract class MovingAverage {
  protected result: Big | undefined;

  constructor(protected readonly interval: number) {}

  getResult(): Big {
    if (!this.result) {
      throw Error('Not enough input data');
    }
    return this.result;
  }

  abstract update(price: BigSource): void;
}
