import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator';
import {FasterSmoothingIndicator, SmoothingIndicator} from '../MA/MovingAverageTypes';
import {FasterTR, TR} from '../TR/TR';
import {HighLowClose, HighLowCloseNumber} from '../util';

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
export class ATR extends BigIndicatorSeries<HighLowClose> {
  private readonly tr: TR;

  constructor(public readonly smoothing: SmoothingIndicator) {
    super();
    this.tr = new TR();
  }

  override update(candle: HighLowClose): Big | void {
    const trueRange = this.tr.update(candle);
    this.smoothing.update(trueRange);
    if (this.smoothing.isStable) {
      return this.setResult(this.smoothing.getResult());
    }
  }
}

export class FasterATR extends NumberIndicatorSeries<HighLowCloseNumber> {
  private readonly tr: FasterTR;

  constructor(public readonly smoothing: FasterSmoothingIndicator) {
    super();
    this.tr = new FasterTR();
  }

  update(candle: HighLowCloseNumber): number | void {
    const trueRange = this.tr.update(candle);
    this.smoothing.update(trueRange);
    if (this.smoothing.isStable) {
      return this.setResult(this.smoothing.getResult());
    }
  }
}
