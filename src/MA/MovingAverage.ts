import type {Big, BigSource} from '../index.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';

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

  updates(prices: BigSource[]): Big | void {
    prices.forEach(price => this.update(price));
    return this.result;
  }

  abstract update(price: BigSource, replace?: boolean): Big | void;
}

export abstract class FasterMovingAverage extends NumberIndicatorSeries {
  constructor(public readonly interval: number) {
    super();
  }

  updates(prices: number[]): number | void {
    prices.forEach(price => this.update(price));
    return this.result;
  }

  abstract update(price: number, replace?: boolean): number | void;
}
