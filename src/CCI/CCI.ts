import {BigIndicatorSeries} from '../Indicator';
import {Big, BigSource} from 'big.js';
import {NotEnoughDataError} from '../error';
import {HighLowClose} from '../util';
import {SMA} from '../SMA/SMA';
import {MAD} from '../MAD/MAD';

/**
 * Commodity Channel Index (CCI)
 * Type: Momentum
 *
 * The Commodity Channel Index (CCI) compares the current mean price with the average mean price over a period of time.
 *
 * @see https://en.wikipedia.org/wiki/Commodity_channel_index
 */
export class CCI extends BigIndicatorSeries {
  public readonly prices: BigSource[] = [];
  protected result?: Big;
  private readonly sma: SMA;
  private readonly typicalPrices: Big[] = [];

  constructor(public readonly interval: number) {
    super();
    this.sma = new SMA(this.interval);
  }

  get isStable(): boolean {
    return this.result !== undefined;
  }

  getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  update(candle: HighLowClose): void | Big {
    const typicalPrice = this.cacheTypicalPrice(candle);
    this.sma.update(typicalPrice);
    if (this.sma.isStable) {
      const mean = this.sma.getResult();
      const meanDeviation = MAD.getResultFromBatch(this.typicalPrices, mean);
      const a = typicalPrice.minus(mean);
      const b = new Big(0.015).mul(meanDeviation);
      return this.setResult(a.div(b));
    }
  }

  private cacheTypicalPrice({high, low, close}: HighLowClose): Big {
    const typicalPrice = new Big(high).plus(low).plus(close).div(3);
    this.typicalPrices.push(typicalPrice);
    if (this.typicalPrices.length > this.interval) {
      this.typicalPrices.shift();
    }
    return typicalPrice;
  }
}
