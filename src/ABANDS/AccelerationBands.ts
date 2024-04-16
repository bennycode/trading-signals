import {Big} from '../index.js';
import {FasterSMA, SMA} from '../SMA/SMA.js';
import {NotEnoughDataError} from '../error/index.js';
import type {BandsResult, FasterBandsResult} from '../util/BandsResult.js';
import type {Indicator} from '../Indicator.js';
import type {FasterMovingAverageTypes, MovingAverageTypes} from '../MA/MovingAverageTypes.js';
import type {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage.js';
import type {HighLowClose, HighLowCloseNumber} from '../util/index.js';

export class AccelerationBands implements Indicator<BandsResult, HighLowClose> {
  private readonly lowerBand: MovingAverage;
  private readonly middleBand: MovingAverage;
  private readonly upperBand: MovingAverage;

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
  constructor(
    public readonly interval: number,
    public readonly width: number,
    SmoothingIndicator: MovingAverageTypes = SMA
  ) {
    this.lowerBand = new SmoothingIndicator(interval);
    this.middleBand = new SmoothingIndicator(interval);
    this.upperBand = new SmoothingIndicator(interval);
  }

  get isStable(): boolean {
    return this.middleBand.isStable;
  }

  update({high, low, close}: HighLowClose): void {
    const highPlusLow = new Big(high).plus(low);
    const coefficient = highPlusLow.eq(0) ? new Big(0) : new Big(high).minus(low).div(highPlusLow).mul(this.width);

    // (Low * (1 - width * (High - Low)/ (High + Low)))
    this.lowerBand.update(new Big(low).mul(new Big(1).minus(coefficient)));
    // (Close)
    this.middleBand.update(close);
    // (High * ( 1 + width * (High - Low) / (High + Low)))
    this.upperBand.update(new Big(high).mul(new Big(1).plus(coefficient)));
  }

  getResult(): BandsResult {
    if (!this.isStable) {
      throw new NotEnoughDataError();
    }

    return {
      lower: this.lowerBand.getResult(),
      middle: this.middleBand.getResult(),
      upper: this.upperBand.getResult(),
    };
  }
}

export class FasterAccelerationBands implements Indicator<FasterBandsResult, HighLowCloseNumber> {
  private readonly lowerBand: FasterMovingAverage;
  private readonly middleBand: FasterMovingAverage;
  private readonly upperBand: FasterMovingAverage;

  constructor(
    public readonly interval: number,
    public readonly width: number,
    SmoothingIndicator: FasterMovingAverageTypes = FasterSMA
  ) {
    this.lowerBand = new SmoothingIndicator(interval);
    this.middleBand = new SmoothingIndicator(interval);
    this.upperBand = new SmoothingIndicator(interval);
  }

  update({high, low, close}: HighLowCloseNumber): void {
    const highPlusLow = high + low;
    const coefficient = highPlusLow === 0 ? 0 : ((high - low) / highPlusLow) * this.width;

    this.lowerBand.update(low * (1 - coefficient));
    this.middleBand.update(close);
    this.upperBand.update(high * (1 + coefficient));
  }

  get isStable(): boolean {
    return this.middleBand.isStable;
  }

  getResult(): FasterBandsResult {
    if (!this.isStable) {
      throw new NotEnoughDataError();
    }

    return {
      lower: this.lowerBand.getResult(),
      middle: this.middleBand.getResult(),
      upper: this.upperBand.getResult(),
    };
  }
}
