import {BigIndicatorSeries} from '../Indicator';
import Big, {BigSource} from 'big.js';
import {getFixedArray} from '../util/getFixedArray';
import {NotEnoughDataError} from '../error';

/**
 * Momentum Indicator (MOM)
 * Type: Momentum
 *
 * The Momentum indicator returns the change between the current price and the price n times ago.
 *
 * @see https://www.warriortrading.com/momentum-indicator/
 */
export class MOM extends BigIndicatorSeries {
  private readonly history: BigSource[];
  private readonly historyLength: number;

  constructor(public readonly length: number) {
    super();
    this.historyLength = length + 1;
    this.history = getFixedArray<BigSource>(this.historyLength);
  }

  override update(value: BigSource): void {
    this.history.push(value);
    if (this.history.length === this.historyLength) {
      this.setResult(new Big(value).minus(this.history[0]));
    }
  }

  override get isStable(): boolean {
    return this.result !== undefined;
  }

  override getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }
}
