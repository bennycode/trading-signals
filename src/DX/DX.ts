import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import type {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage.js';
import type {FasterMovingAverageTypes, MovingAverageTypes} from '../MA/MovingAverageTypes.js';
import {FasterWSMA, WSMA} from '../WSMA/WSMA.js';
import {ATR, FasterATR} from '../ATR/ATR.js';
import type {BigSource} from 'big.js';
import Big from 'big.js';
import type {HighLowClose} from '../util/HighLowClose.js';

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
  private secondLastCandle?: HighLowClose;
  private readonly atr: ATR;
  /** Negative (Minus) Directional Indicator (-DI) */
  public mdi?: Big;
  /** Positive (Plus) Directional Indicator (+DI) */
  public pdi?: Big;

  constructor(
    public readonly interval: number,
    SmoothingIndicator: MovingAverageTypes = WSMA
  ) {
    super();
    this.atr = new ATR(this.interval, SmoothingIndicator);
    this.movesDown = new SmoothingIndicator(this.interval);
    this.movesUp = new SmoothingIndicator(this.interval);
  }

  private updateState(candle: HighLowClose, pdm: BigSource, mdm: BigSource, replace: boolean): void {
    this.atr.update(candle, replace);
    this.movesDown.update(mdm, replace);
    this.movesUp.update(pdm, replace);
    if (this.previousCandle) {
      this.secondLastCandle = this.previousCandle;
    }
    this.previousCandle = candle;
  }

  override getRequiredInputs() {
    return this.movesUp.getRequiredInputs();
  }

  update(candle: HighLowClose, replace: boolean) {
    if (!this.previousCandle) {
      this.updateState(candle, 0, 0, replace);
      return null;
    }

    if (this.secondLastCandle && replace) {
      this.previousCandle = this.secondLastCandle;
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

    this.updateState(candle, pdm, mdm, replace);

    if (this.movesUp.isStable) {
      this.pdi = this.movesUp.getResultOrThrow().div(this.atr.getResultOrThrow());
      this.mdi = this.movesDown.getResultOrThrow().div(this.atr.getResultOrThrow());

      const dmDiff = this.pdi.minus(this.mdi).abs();
      const dmSum = this.pdi.plus(this.mdi);

      // Prevent division by zero
      if (dmSum.eq(0)) {
        return this.setResult(new Big(0), replace);
      }

      return this.setResult(dmDiff.div(dmSum).mul(100), replace);
    }

    return null;
  }
}

export class FasterDX extends NumberIndicatorSeries<HighLowClose<number>> {
  private readonly movesUp: FasterMovingAverage;
  private readonly movesDown: FasterMovingAverage;
  private previousCandle?: HighLowClose<number>;
  private secondLastCandle?: HighLowClose<number>;
  private readonly atr: FasterATR;
  public mdi?: number;
  public pdi?: number;

  constructor(
    public readonly interval: number,
    SmoothingIndicator: FasterMovingAverageTypes = FasterWSMA
  ) {
    super();
    this.atr = new FasterATR(this.interval, SmoothingIndicator);
    this.movesDown = new SmoothingIndicator(this.interval);
    this.movesUp = new SmoothingIndicator(this.interval);
  }

  private updateState(candle: HighLowClose<number>, pdm: number, mdm: number, replace: boolean): void {
    this.atr.update(candle, replace);
    this.movesUp.update(pdm, replace);
    this.movesDown.update(mdm, replace);
    if (this.previousCandle) {
      this.secondLastCandle = this.previousCandle;
    }
    this.previousCandle = candle;
  }

  override getRequiredInputs() {
    return this.movesUp.getRequiredInputs();
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    if (!this.previousCandle) {
      this.updateState(candle, 0, 0, replace);
      return null;
    }

    if (this.secondLastCandle && replace) {
      this.previousCandle = this.secondLastCandle;
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

    this.updateState(candle, pdm, mdm, replace);

    if (this.movesUp.isStable) {
      this.pdi = this.movesUp.getResultOrThrow() / this.atr.getResultOrThrow();
      this.mdi = this.movesDown.getResultOrThrow() / this.atr.getResultOrThrow();

      const dmDiff = Math.abs(this.pdi - this.mdi);
      const dmSum = this.pdi + this.mdi;

      if (dmSum === 0) {
        return this.setResult(0, replace);
      }

      return this.setResult((dmDiff / dmSum) * 100, replace);
    }

    return null;
  }
}
