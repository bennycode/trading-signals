import Big, {BigSource} from 'big.js';
import {NotEnoughDataError, SMMA} from '..';

type Candle = {close: BigSource; high: BigSource; low: BigSource};

/**
 * Average True Range
 *
 * The idea of ranges is that they show the commitment or enthusiasm of traders. Large or increasing ranges suggest
 * traders prepared to continue to bid up or sell down a stock through the course of the day. Decreasing range suggests
 * waning interest.
 */
export class ATR {
  private readonly interval: number;
  private readonly smma: SMMA;
  private readonly candles: Candle[] = [];

  private result: Big | undefined;
  private prevCandle: Candle | undefined;

  constructor(interval: number) {
    this.interval = interval;

    this.smma = new SMMA(interval);
  }

  get isStable(): boolean {
    return this.candles.length > this.interval;
  }

  update(candle: Candle): void {
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

    this.smma.update(trueRange);

    this.result = this.smma.getResult();
    this.prevCandle = candle;
  }

  getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }
    return this.result;
  }

  private trueRange(prevCandle: Candle, currentCandle: Candle): Big {
    const prevClose = new Big(prevCandle.close);
    const low = new Big(currentCandle.low);
    const high = new Big(currentCandle.high);
    return this.getMaximum([high.sub(low), high.sub(prevClose).abs(), low.sub(prevClose).abs()]);
  }

  private getMaximum(values: Big[]): Big {
    return values.reduce((max: Big, current: Big) => (current.gt(max) ? current : max), values[0]);
  }
}
