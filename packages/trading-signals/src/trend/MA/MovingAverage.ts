import {IndicatorInputShape, IndicatorSeries} from '../../base/Indicator.js';
import {MOM} from '../../momentum/MOM/MOM.js';

/**
 * Moving Average (MA)
 * Type: Trend
 *
 * Base class for trend-following (lagging) indicators. The longer the moving average interval, the greater the lag.
 *
 * Interpretation:
 * The direction of the average is the trend. Each average is compared with its value one interval
 * earlier, so with an interval of 3 the average of the last 3 inputs is weighed against the average
 * of the 3 inputs before them: higher is bullish, lower bearish, unchanged sideways.
 *
 * @see https://www.investopedia.com/terms/m/movingaverage.asp
 */
export abstract class MovingAverage extends IndicatorSeries {
  // Every moving average smooths a single value series, so the shape is fixed for the family.
  override readonly inputShape = IndicatorInputShape.PRICE;

  public readonly interval: number;

  readonly #slope: MOM;

  constructor(interval: number) {
    super();
    this.interval = interval;
    this.#slope = new MOM(interval);
  }

  protected override setResult(value: number, replace: boolean) {
    const result = super.setResult(value, replace);

    // Readings from the warm-up are not trustworthy yet, so they must not shape the trend.
    if (this.isStable) {
      this.#slope.update(result, replace);
    }

    return result;
  }

  getSignal() {
    return this.#slope.getSignal();
  }
}
