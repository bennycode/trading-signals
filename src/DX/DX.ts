import {BigIndicatorSeries} from '../Indicator';
import {HighLowClose} from '../util';
import Big from 'big.js';
import {MovingAverage} from '../MA/MovingAverage';
import {MovingAverageTypeContext} from '../MA/MovingAverageTypeContext';
import {WSMA} from '../WSMA/WSMA';
import {ATR} from '../ATR/ATR';

/**
 * Momentum
 * DX, DMI
 * https://www.tradingview.com/scripts/directionalmovement/
 * https://medium.com/codex/algorithmic-trading-with-average-directional-index-in-python-2b5a20ecf06a
 */
export class DX extends BigIndicatorSeries {
  private readonly movesUp: MovingAverage;
  private readonly movesDown: MovingAverage;
  private previousCandle?: HighLowClose;
  private readonly atr: ATR;

  constructor(public readonly interval: number, Indicator: MovingAverageTypeContext = WSMA) {
    super();
    this.movesUp = new Indicator(this.interval);
    this.movesDown = new Indicator(this.interval);
    this.atr = new ATR(this.interval, Indicator);
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

    // +DM
    const pdm = noHigherHighs || lowsRiseFaster ? new Big(0) : higherHigh;

    const noLowerLows = lowerLow.lt(0);
    const highsRiseFaster = lowerLow.lt(higherHigh);

    // -DM
    const mdm = noLowerLows || highsRiseFaster ? new Big(0) : lowerLow;

    this.movesUp.update(pdm);
    this.movesDown.update(mdm);
    this.atr.update(candle);
    this.previousCandle = candle;

    if (this.movesUp.isStable) {
      // +DI
      const pdi = this.movesUp.getResult().div(this.atr.getResult());
      // -DI
      const mdi = this.movesDown.getResult().div(this.atr.getResult());

      const dmDiff = pdi.minus(mdi).abs();
      const dmSum = pdi.plus(mdi);

      return this.setResult(dmDiff.div(dmSum).mul(100));
    }
  }
}
