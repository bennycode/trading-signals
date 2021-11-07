import Big, {BigSource} from 'big.js';
import {NotEnoughDataError} from '../error';
import {NumberIndicatorSeries, BigIndicatorSeries} from '../Indicator';

/**
 * Moving Average (MA)
 * Type: Trend
 *
 * Base class for trend-following (lagging) indicators. The longer the moving average interval, the greater the lag.
 *
 * @see https://www.investopedia.com/terms/m/movingaverage.asp
 */
export abstract class MovingAverage extends BigIndicatorSeries {
  constructor(public readonly interval: number) {
    super();
  }

  override get isStable(): boolean {
    return !!this.result;
  }

  override getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }
    return this.result;
  }

  abstract update(price: BigSource): Big | void;
}

export abstract class FasterMovingAverage extends NumberIndicatorSeries {
  constructor(public readonly interval: number) {
    super();
  }

  override get isStable(): boolean {
    return !!this.result;
  }

  override getResult(): number {
    if (!this.result) {
      throw new NotEnoughDataError();
    }
    return this.result;
  }

  abstract update(price: number): number | void;
}
