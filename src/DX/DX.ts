import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator';
import {HighLowClose, HighLowCloseNumber} from '../util';
import Big, {BigSource} from 'big.js';
import {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage';
import {FasterMovingAverageTypes, MovingAverageTypes} from '../MA/MovingAverageTypes';
import {FasterWSMA, WSMA} from '../WSMA/WSMA';
import {ATR, FasterATR} from '../ATR/ATR';

/**
 * Directional Movement Index (DMI / DX)
 * Type: Momentum, Trend (using +DI & -DI)
 *
 * The DX was developed by **John Welles Wilder, Jr.**. and may help traders assess the strength of a trend (momentum)
 * and direction of the trend.
 *
 * If there is no change in the trend, then the DX is `0`. The return value increases when there is a stronger trend
 * (either negative or positive). To detect if the trend is bullish or bearish you have to compare +DI and -DI. When
 * +DI is above -DI, then there is more upward pressure than downward pressure in the market.
 *
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/dmi
 */
export class DX extends BigIndicatorSeries<HighLowClose> {
  private readonly movesUp: MovingAverage;
  private readonly movesDown: MovingAverage;
  private previousCandle?: HighLowClose;
  private readonly atr: ATR;
  /** Minus Directional Indicator (-DI) */
  public mdi?: Big;
  /** Plus Directional Indicator (+DI) */
  public pdi?: Big;

  constructor(public readonly interval: number, SmoothingIndicator: MovingAverageTypes = WSMA) {
    super();
    this.atr = new ATR(this.interval, SmoothingIndicator);
    this.movesDown = new SmoothingIndicator(this.interval);
    this.movesUp = new SmoothingIndicator(this.interval);
  }

  private updateState(candle: HighLowClose, pdm: BigSource = 0, mdm: BigSource = 0): void {
    this.atr.update(candle);
    this.movesDown.update(mdm);
    this.movesUp.update(pdm);
    this.previousCandle = candle;
  }

  update(candle: HighLowClose): Big | void {
    if (!this.previousCandle) {
      this.updateState(candle);
      return;
    }

    const currentHigh = new Big(candle.high);
    const previousHigh = new Big(this.previousCandle.high);

    const currentLow = new Big(candle.low);
    const previousLow = new Big(this.previousCandle.low);

    const higherHigh = currentHigh.minus(previousHigh);
    const lowerLow = previousLow.minus(currentLow);

    const noHigherHighs = higherHigh.lt(0);
    const lowsRiseFaster = higherHigh.lt(lowerLow);

    // Plus Directional Movement (+DM)
    const pdm = noHigherHighs || lowsRiseFaster ? new Big(0) : higherHigh;

    const noLowerLows = lowerLow.lt(0);
    const highsRiseFaster = lowerLow.lt(higherHigh);

    // Minus Directional Movement (-DM)
    const mdm = noLowerLows || highsRiseFaster ? new Big(0) : lowerLow;

    this.updateState(candle, pdm, mdm);

    if (this.movesUp.isStable) {
      this.pdi = this.movesUp.getResult().div(this.atr.getResult());
      this.mdi = this.movesDown.getResult().div(this.atr.getResult());

      const dmDiff = this.pdi.minus(this.mdi).abs();
      const dmSum = this.pdi.plus(this.mdi);

      // Prevent division by zero
      if (dmSum.eq(0)) {
        return this.setResult(new Big(0));
      }

      return this.setResult(dmDiff.div(dmSum).mul(100));
    }
  }
}

export class FasterDX extends NumberIndicatorSeries<HighLowCloseNumber> {
  private readonly movesUp: FasterMovingAverage;
  private readonly movesDown: FasterMovingAverage;
  private previousCandle?: HighLowCloseNumber;
  private readonly atr: FasterATR;
  public mdi?: number;
  public pdi?: number;

  constructor(public readonly interval: number, SmoothingIndicator: FasterMovingAverageTypes = FasterWSMA) {
    super();
    this.atr = new FasterATR(this.interval, SmoothingIndicator);
    this.movesDown = new SmoothingIndicator(this.interval);
    this.movesUp = new SmoothingIndicator(this.interval);
  }

  private updateState(candle: HighLowCloseNumber, pdm: number = 0, mdm: number = 0): void {
    this.atr.update(candle);
    this.movesUp.update(pdm);
    this.movesDown.update(mdm);
    this.previousCandle = candle;
  }

  update(candle: HighLowCloseNumber): number | void {
    if (!this.previousCandle) {
      this.updateState(candle);
      return;
    }

    const currentHigh = candle.high;
    const previousHigh = this.previousCandle.high;

    const currentLow = candle.low;
    const previousLow = this.previousCandle.low;

    const higherHigh = currentHigh - previousHigh;
    const lowerLow = previousLow - currentLow;

    const noHigherHighs = higherHigh < 0;
    const lowsRiseFaster = higherHigh < lowerLow;

    const pdm = noHigherHighs || lowsRiseFaster ? 0 : higherHigh;

    const noLowerLows = lowerLow < 0;
    const highsRiseFaster = lowerLow < higherHigh;

    const mdm = noLowerLows || highsRiseFaster ? 0 : lowerLow;

    this.updateState(candle, pdm, mdm);

    if (this.movesUp.isStable) {
      this.pdi = this.movesUp.getResult() / this.atr.getResult();
      this.mdi = this.movesDown.getResult() / this.atr.getResult();

      const dmDiff = Math.abs(this.pdi - this.mdi);
      const dmSum = this.pdi + this.mdi;

      if (dmSum === 0) {
        return this.setResult(0);
      }

      return this.setResult((dmDiff / dmSum) * 100);
    }
  }
}
