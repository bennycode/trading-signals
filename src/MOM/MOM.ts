import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import {Big, BigSource} from '../index.js';
import {getFixedArray} from '../util/getFixedArray.js';

/**
 * Momentum Indicator (MOM / MTM)
 * Type: Momentum
 *
 * The Momentum indicator returns the change between the current price and the price n times ago.
 *
 * @see https://en.wikipedia.org/wiki/Momentum_(technical_analysis)
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

  override update(value: BigSource): void | Big {
    this.history.push(value);
    if (this.history.length === this.historyLength) {
      return this.setResult(new Big(value).minus(this.history[0]));
    }
  }
}

export class FasterMOM extends NumberIndicatorSeries {
  private readonly history: number[];
  private readonly historyLength: number;

  constructor(public readonly interval: number) {
    super();
    this.historyLength = interval + 1;
    this.history = getFixedArray<number>(this.historyLength);
  }

  override update(value: number): void | number {
    this.history.push(value);
    if (this.history.length === this.historyLength) {
      return this.setResult(value - this.history[0]);
    }
  }
}
