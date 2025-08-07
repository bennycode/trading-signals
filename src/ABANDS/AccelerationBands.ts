import {TechnicalIndicator} from '../Indicator.js';
import type {MovingAverage} from '../MA/MovingAverage.js';
import type {MovingAverageMovingAverageTypes} from '../MA/MovingAverageMovingAverageTypes.js';
import {SMA} from '../SMA/SMA.js';
import type {BandsResult} from '../util/BandsResult.js';
import type {HighLowClose} from '../util/index.js';

/**
 * Acceleration Bands (ABANDS)
 * Type: Volatility
 *
 * Acceleration bands created by Price Headley are set as an envelope around a moving average. The upper and lower
 * bands are of equal distance from the middle band.
 *
 * Two consecutive closes outside Acceleration Bands suggest an entry point in the direction of the breakout (either
 * bullish or bearish). A long position is usually kept till the first close back inside the bands.
 *
 * @param interval The interval that is being used for the three moving averages which create lower, middle and upper
 *   bands
 * @param width A coefficient specifying the distance between the middle band and upper/lower bands
 * @param SmoothingIndicator Which moving average (SMA, EMA, ...) to use
 *
 * @see https://www.tradingtechnologies.com/xtrader-help/x-study/technical-indicator-definitions/acceleration-bands-abands/
 * @see https://www.motivewave.com/studies/acceleration_bands.htm
 * @see https://github.com/QuantConnect/Lean/blob/master/Indicators/AccelerationBands.cs
 * @see https://github.com/twopirllc/pandas-ta/blob/master/pandas_ta/volatility/accbands.py
 */
export class AccelerationBands extends TechnicalIndicator<BandsResult, HighLowClose> {
  private readonly lowerBand: MovingAverage;
  private readonly middleBand: MovingAverage;
  private readonly upperBand: MovingAverage;

  constructor(
    public readonly interval: number,
    public readonly width: number,
    SmoothingIndicator: MovingAverageMovingAverageTypes = SMA
  ) {
    super();
    this.lowerBand = new SmoothingIndicator(interval);
    this.middleBand = new SmoothingIndicator(interval);
    this.upperBand = new SmoothingIndicator(interval);
  }

  override get isStable(): boolean {
    return this.middleBand.isStable;
  }

  override getRequiredInputs() {
    return this.middleBand.getRequiredInputs();
  }

  update({high, low, close}: HighLowClose, replace: boolean) {
    const highPlusLow = high + low;
    const coefficient = highPlusLow === 0 ? 0 : (high - low) / highPlusLow * this.width;

    // (Low * (1 - width * (High - Low)/ (High + Low)))
    this.lowerBand.update(low * (1 - coefficient), replace);
    // (Close)
    this.middleBand.update(close, replace);
    // (High * ( 1 + width * (High - Low) / (High + Low)))
    this.upperBand.update(high * (1 + coefficient), replace);

    if (this.isStable) {
      return (this.result = {
        lower: this.lowerBand.getResultOrThrow(),
        middle: this.middleBand.getResultOrThrow(),
        upper: this.upperBand.getResultOrThrow(),
      });
    }

    return null;
  }
}
