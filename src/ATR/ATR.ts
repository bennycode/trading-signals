import Big from 'big.js';
import {NotEnoughDataError} from '../error';
import {BigIndicatorSeries} from '../Indicator';
import {MovingAverage} from '../MA/MovingAverage';
import {MovingAverageTypeContext} from '../MA/MovingAverageTypeContext';
import {SMMA} from '../SMMA/SMMA';
import {HighLowClose} from '../util';

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
  private readonly candles: HighLowClose[] = [];
  private readonly smoothing: MovingAverage;
  private prevCandle: HighLowClose | undefined;

  constructor(public readonly interval: number, SmoothingIndicator: MovingAverageTypeContext = SMMA) {
    super();
    this.smoothing = new SmoothingIndicator(interval);
  }

  override get isStable(): boolean {
    return this.candles.length > this.interval;
  }

  override update(candle: HighLowClose): Big | void {
    this.candles.push(candle);

    if (!this.prevCandle) {
      this.prevCandle = candle;
      return;
    }

    /**
     * The interval is used as a lookback period,
     * therefore one extra candle is kept
     */
    if (this.candles.length > this.interval + 1) {
      this.candles.shift();
    }

    const trueRange = this.trueRange(this.prevCandle, candle);

    this.smoothing.update(trueRange);

    this.prevCandle = candle;
    if (this.smoothing.isStable) {
      return this.setResult(this.smoothing.getResult());
    }
  }

  override getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }
    return this.result;
  }

  private trueRange(prevCandle: HighLowClose, currentCandle: HighLowClose): Big {
    const prevClose = new Big(prevCandle.close);
    const low = new Big(currentCandle.low);
    const high = new Big(currentCandle.high);
    return this.getMaximum([high.sub(low), high.sub(prevClose).abs(), low.sub(prevClose).abs()]);
  }

  private getMaximum(values: Big[]): Big {
    return values.reduce((max: Big, current: Big) => (current.gt(max) ? current : max), values[0]);
  }
}
