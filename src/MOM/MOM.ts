import {BigIndicatorSeries} from '../Indicator';
import Big, {BigSource} from 'big.js';
import {getFixedArray} from '../util/getFixedArray';

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

  constructor(public readonly interval: number) {
    super();
    this.historyLength = interval + 1;
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
}
