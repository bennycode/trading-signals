import Big, {BigSource} from 'big.js';
import {EMA, NotEnoughDataError, SMA, SMMA} from '..';
import {SimpleIndicator} from '../Indicator';
import {MovingAverage} from '../MA/MovingAverage';

export type ATRCandle = {close: BigSource; high: BigSource; low: BigSource};

/**
 * Average True Range
 *
 * The idea of ranges is that they show the commitment or enthusiasm of traders. Large or increasing ranges suggest
 * traders prepared to continue to bid up or sell down a stock through the course of the day. Decreasing range suggests
 * waning interest.
 */
export class ATR extends SimpleIndicator {
  private readonly candles: ATRCandle[] = [];
  private readonly indicator: MovingAverage;
  private prevCandle: ATRCandle | undefined;

  constructor(public readonly interval: number, Indicator: typeof EMA | typeof SMA | typeof SMMA = SMMA) {
    super();
    this.indicator = new Indicator(interval);
  }

  override get isStable(): boolean {
    return this.candles.length > this.interval;
  }

  override update(candle: ATRCandle): void {
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

    this.indicator.update(trueRange);

    this.setResult(this.indicator.getResult());
    this.prevCandle = candle;
  }

  override getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }
    return this.result;
  }

  private trueRange(prevCandle: ATRCandle, currentCandle: ATRCandle): Big {
    const prevClose = new Big(prevCandle.close);
    const low = new Big(currentCandle.low);
    const high = new Big(currentCandle.high);
    return this.getMaximum([high.sub(low), high.sub(prevClose).abs(), low.sub(prevClose).abs()]);
  }

  private getMaximum(values: Big[]): Big {
    return values.reduce((max: Big, current: Big) => (current.gt(max) ? current : max), values[0]);
  }
}
