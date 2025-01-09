import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import {getFixedArray, pushUpdate, type HighLowClose, type HighLowCloseNumber} from '../util/index.js';
import {FasterSMA, SMA} from '../SMA/SMA.js';
import {FasterMAD, MAD} from '../MAD/MAD.js';
import type {BigSource} from 'big.js';
import Big from 'big.js';

/**
 * Commodity Channel Index (CCI)
 * Type: Momentum
 *
 * The Commodity Channel Index (CCI), developed by Donald Lambert in 1980, compares the current mean price with the
 * average mean price over a period of time. Approximately 70 to 80 percent of CCI values are between −100 and +100,
 * which makes it an oscillator. Values above +100 imply an overbought condition, while values below −100 imply an
 * oversold condition.
 *
 * According to
 * [Investopia.com](https://www.investopedia.com/articles/active-trading/031914/how-traders-can-utilize-cci-commodity-channel-index-trade-stock-trends.asp#multiple-timeframe-cci-strategy),
 * traders often buy when the CCI dips below -100 and then rallies back above -100 to sell the security when it moves
 * above +100 and then drops back below +100.
 *
 * @see https://en.wikipedia.org/wiki/Commodity_channel_index
 */
export class CCI extends BigIndicatorSeries<HighLowClose> {
  public readonly prices: BigSource[] = [];
  private readonly sma: SMA;
  private readonly typicalPrices: Big[];

  constructor(public readonly interval: number) {
    super();
    this.sma = new SMA(this.interval);
    this.typicalPrices = getFixedArray(interval);
  }

  update(candle: HighLowClose, replace: boolean) {
    const typicalPrice = this.cacheTypicalPrice(candle, replace);
    this.sma.update(typicalPrice, replace);

    if (this.sma.isStable) {
      const mean = this.sma.getResult();
      const meanDeviation = MAD.getResultFromBatch(this.typicalPrices, mean);
      const numerator = typicalPrice.minus(mean);
      const denominator = new Big(0.015).mul(meanDeviation);
      return this.setResult(numerator.div(denominator), replace);
    }

    return null;
  }

  private cacheTypicalPrice({high, low, close}: HighLowClose, replace: boolean): Big {
    const typicalPrice = new Big(high).plus(low).plus(close).div(3);
    return pushUpdate(this.typicalPrices, replace, typicalPrice);
  }
}

export class FasterCCI extends NumberIndicatorSeries<HighLowCloseNumber> {
  public readonly prices: number[] = [];
  private readonly sma: FasterSMA;
  private readonly typicalPrices: number[];

  constructor(public readonly interval: number) {
    super();
    this.sma = new FasterSMA(this.interval);
    this.typicalPrices = getFixedArray(interval);
  }

  update(candle: HighLowCloseNumber, replace: boolean) {
    const typicalPrice = this.cacheTypicalPrice(candle, replace);
    this.sma.update(typicalPrice, replace);

    if (this.sma.isStable) {
      const mean = this.sma.getResult();
      const meanDeviation = FasterMAD.getResultFromBatch(this.typicalPrices, mean);
      const numerator = typicalPrice - mean;
      const denominator = 0.015 * meanDeviation;
      return this.setResult(numerator / denominator, replace);
    }

    return null;
  }

  private cacheTypicalPrice({high, low, close}: HighLowCloseNumber, replace: boolean): number {
    const typicalPrice = (high + low + close) / 3;
    return pushUpdate(this.typicalPrices, replace, typicalPrice);
  }
}
