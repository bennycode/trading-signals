import {BigIndicatorSeries} from '../Indicator';
import {Big, BigSource} from 'big.js';
import {HighLowClose} from '../util';
import {SMA} from '../SMA/SMA';
import {MAD} from '../MAD/MAD';

/**
 * Commodity Channel Index (CCI)
 * Type: Momentum
 *
 * The Commodity Channel Index (CCI), developed by Donald Lambert in 1980, compares the current mean price with the average mean price over a period of time. Approximately 70 to 80 percent of CCI values are between −100 and +100, which makes it an oscillator. Values above +100 imply an overbought condition, while values below −100 imply an oversold condition.
 *
 * According to [Investopia.com](https://www.investopedia.com/articles/active-trading/031914/how-traders-can-utilize-cci-commodity-channel-index-trade-stock-trends.asp#multiple-timeframe-cci-strategy), traders often buy when the CCI dips below -100 and then rallies back above -100 to sell the security when it moves above +100 and then drops back below +100.
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
