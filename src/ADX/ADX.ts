import {Big} from 'big.js';
import {NotEnoughDataError} from '../error';
import {ATR, ATRCandle, MathAnalysis, SMMA} from '..';
import {SimpleIndicator} from '../Indicator';

/**
 * Average Directional Index
 *
 * The ADX does not indicate trend direction or momentum, only trend strength. It is a lagging indicator; that is, a
 * trend must have established itself before the ADX will generate a signal that a trend is under way.
 *
 * ADX will range between 0 and 100.
 *
 * Generally, ADX readings below 20 indicate trend weakness, and readings above 40 indicate trend strength.
 * An extremely strong trend is indicated by readings above 50.
 */
export class ADX implements SimpleIndicator {
  private readonly candles: ATRCandle[] = [];
  private readonly atr: ATR;
  private readonly smoothedPDM: SMMA;
  private readonly smoothedMDM: SMMA;
  private readonly dxValues: Big[] = [];
  private prevCandle: ATRCandle | undefined;
  private result: Big | undefined;

  constructor(public interval: number) {
    this.atr = new ATR(interval);
    this.smoothedPDM = new SMMA(interval);
    this.smoothedMDM = new SMMA(interval);
  }

  get isStable(): boolean {
    return this.dxValues.length >= this.interval;
  }

  update(candle: ATRCandle): void {
    this.candles.push(candle);
    this.atr.update(candle);

    if (!this.prevCandle) {
      this.prevCandle = candle;
      return;
    }

    /**
     * Plus Directional Movement (+DM) and
     * Minus Directional Movement (-DM)
     * for this period.
     */
    const {mdm, pdm} = this.directionalMovement(this.prevCandle, candle);

    /**
     * Smooth these periodic values using SMMA.
     */
    this.smoothedMDM.update(mdm);
    this.smoothedPDM.update(pdm);

    // prevCandle isn't needed anymore therefore we can update it for the next iteration.
    this.prevCandle = candle;

    if (this.candles.length <= this.interval) {
      return;
    }

    /**
     * Divide the smoothed Plus Directional Movement (+DM)
     * by the smoothed True Range (ATR) to find the Plus Directional Indicator (+DI).
     * Multiply by 100 to move the decimal point two places.
     *
     * This is the green Plus Directional Indicator line (+DI) when plotting.
     */
    const pdi = this.smoothedPDM.getResult().div(this.atr.getResult()).times(100);

    /**
     * Divide the smoothed Minus Directional Movement (-DM)
     * by the smoothed True Range (ATR) to find the Minus Directional Indicator (-DI).
     * Multiply by 100 to move the decimal point two places.
     *
     * This is the red Minus Directional Indicator line (-DI) when plotting.
     */
    const mdi = this.smoothedMDM.getResult().div(this.atr.getResult()).times(100);

    /**
     * The Directional Movement Index (DX) equals
     * the absolute value of +DI less -DI
     * divided by the sum of +DI and -DI.
     *
     * Multiply by 100 to move the decimal point two places.
     */
    const dx = pdi.sub(mdi).abs().div(pdi.add(mdi)).times(100);

    /**
     * The dx values only really have to be kept for the very first ADX calculation
     */
    this.dxValues.push(dx);
    if (this.dxValues.length > this.interval) {
      this.dxValues.shift();
    }

    if (this.dxValues.length < this.interval) {
      /**
       * ADX can only be calculated once <interval> dx values have been calculated.
       * This means the ADX needs <interval> * 2 candles before being able to give any results.
       */
      return;
    }

    if (!this.result) {
      /**
       * The first ADX value is simply a <interval> average of DX.
       */
      this.result = MathAnalysis.getAverage(this.dxValues);
      return;
    }

    /**
     * Subsequent ADX values are smoothed by multiplying
     * the previous ADX value by <interval - 1>,
     * adding the most recent DX value,
     * and dividing this total by <interval>.
     */
    this.result = this.result
      .times(this.interval - 1)
      .add(dx)
      .div(this.interval);
  }

  getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }
    return this.result;
  }

  private directionalMovement(prevCandle: ATRCandle, currentCandle: ATRCandle): {mdm: Big; pdm: Big} {
    const currentHigh = new Big(currentCandle.high);
    const lastHigh = new Big(prevCandle.high);

    const currentLow = new Big(currentCandle.low);
    const lastLow = new Big(prevCandle.low);

    const upMove = currentHigh.sub(lastHigh);
    const downMove = lastLow.sub(currentLow);

    return {
      /**
       * If the downmove is greater than the upmove and greater than zero,
       * the -DM equals the downmove; otherwise, it equals zero.
       */
      mdm: downMove.gt(upMove) && downMove.gt(new Big(0)) ? downMove : new Big(0),
      /**
       * If the upmove is greater than the downmove and greater than zero,
       * the +DM equals the upmove; otherwise, it equals zero.
       */
      pdm: upMove.gt(downMove) && upMove.gt(new Big(0)) ? upMove : new Big(0),
    };
  }
}
