import {SimpleIndicator} from '../Indicator';
import Big, {BigSource} from 'big.js';
import {getFixedArray} from '../util/getFixedArray';
import {NotEnoughDataError} from '../error';

/**
 * The Momentum indicator returns the change between the current price and the price n times ago.
 */
export class MOM implements SimpleIndicator {
  private readonly history: BigSource[];
  private readonly historyLength: number;
  private result: Big | undefined;

  constructor(public readonly length: number) {
    this.historyLength = length + 1;
    this.history = getFixedArray<BigSource>(this.historyLength);
  }

  update(value: BigSource): void {
    this.history.push(value);
    if (this.history.length === this.historyLength) {
      this.result = new Big(value).minus(this.history[0]);
    }
  }

  get isStable(): boolean {
    return this.result !== undefined;
  }

  getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }
}
