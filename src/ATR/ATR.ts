import Big from 'big.js';
import {BigIndicatorSeries} from '../Indicator';
import {MovingAverage} from '../MA/MovingAverage';
import {MovingAverageTypeContext} from '../MA/MovingAverageTypeContext';
import {TR} from '../TR/TR';
import {HighLowClose} from '../util';
import {WSMA} from '../WSMA/WSMA';

/**
 * Average True Range (ATR)
 * Type: Volatility
 *
 * The ATR was developed by **John Welles Wilder, Jr.**. The idea of ranges is that they show the commitment or
 * enthusiasm of traders. Large or increasing ranges suggest traders prepared to continue to bid up or sell down a
 * stock through the course of the day. Decreasing range indicates declining interest.
 *
 * @see https://www.investopedia.com/terms/a/atr.asp
 */
export class ATR extends BigIndicatorSeries {
  private readonly tr: TR;
  private readonly smoothing: MovingAverage;

  constructor(public readonly interval: number, SmoothingIndicator: MovingAverageTypeContext = WSMA) {
    super();
    this.tr = new TR();
    this.smoothing = new SmoothingIndicator(interval);
  }

  override update(candle: HighLowClose): Big | void {
    const trueRange = this.tr.update(candle);
    this.smoothing.update(trueRange);
    if (this.smoothing.isStable) {
      return this.setResult(this.smoothing.getResult());
    }
  }
}
