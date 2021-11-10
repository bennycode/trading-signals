import {Indicator} from '../Indicator';
import {Big, BigSource} from 'big.js';
import {NotEnoughDataError} from '../error';
import {getFixedArray, HighLowClose} from '../util';
import {SMA} from '../SMA/SMA';
import {getMeanAbsoluteDeviation} from '../MAD/MAD';

/**
 * Commodity Channel Index (CCI)
 * Type: Momentum
 *
 * The Commodity Channel Index (CCI) compares the current mean price with the average mean price over a period of time.
 *
 * @see https://en.wikipedia.org/wiki/Commodity_channel_index
 */
export class CCI implements Indicator<Big> {
  public readonly prices: BigSource[] = [];
  private result?: Big;
  private readonly sma: SMA;
  private readonly typicalPrices: Big[];

  constructor(public readonly interval: number) {
    this.sma = new SMA(this.interval);
    this.typicalPrices = getFixedArray(this.interval);
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

  update({high, low, close}: HighLowClose): void {
    const typicalPrice = new Big(high).plus(low).plus(close).div(3);
    this.typicalPrices.push(typicalPrice);
    this.sma.update(typicalPrice);
    if (this.sma.isStable) {
      const mean = this.sma.getResult();
      const meanDeviation = getMeanAbsoluteDeviation(this.typicalPrices, mean);
      const a = typicalPrice.minus(mean);
      const b = new Big(0.015).mul(meanDeviation);
      this.result = a.div(b);
    }
  }
}
