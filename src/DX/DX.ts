import {BigIndicatorSeries} from '../Indicator';
import {HighLowClose} from '../util';
import Big from 'big.js';
import {MovingAverage} from '../MA/MovingAverage';
import {MovingAverageTypes} from '../MA/MovingAverageTypes';
import {WSMA} from '../WSMA/WSMA';
import {ATR} from '../ATR/ATR';

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
    this.movesUp = new SmoothingIndicator(this.interval);
    this.movesDown = new SmoothingIndicator(this.interval);
    this.atr = new ATR(this.interval, SmoothingIndicator);
  }

  update(candle: HighLowClose): Big | void {
    if (!this.previousCandle) {
      this.atr.update(candle);
      this.movesUp.update(new Big(0));
      this.movesDown.update(new Big(0));
      this.previousCandle = candle;
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

    this.movesUp.update(pdm);
    this.movesDown.update(mdm);
    this.atr.update(candle);
    this.previousCandle = candle;

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
