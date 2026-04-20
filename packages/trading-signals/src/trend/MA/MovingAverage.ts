import {IndicatorSeries} from '../../types/Indicator.js';

/**
 * Moving Average (MA)
 * Type: Trend
 *
 * Base class for trend-following (lagging) indicators. The longer the moving average interval, the greater the lag.
 *
 * @see https://www.investopedia.com/terms/m/movingaverage.asp
 */
export abstract class MovingAverage extends IndicatorSeries {
  public readonly interval: number;

  constructor(interval: number) {
    super();
    this.interval = interval;
  }
}
