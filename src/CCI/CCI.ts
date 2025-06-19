import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import {FasterMAD, MAD} from '../MAD/MAD.js';
import {FasterSMA, SMA} from '../SMA/SMA.js';
import {pushUpdate, type HighLowClose} from '../util/index.js';

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
 * Interpretation:
 * -100 and below: Indicates an oversold condition or the start of a strong downtrend.
 * +100 and above: Indicates an overbought condition or the start of a strong uptrend.
 * Values near 0 often signal a lack of clear momentum.
 *
 * Note: Traders often combine CCI with other indicators to confirm trends or signals, as using it alone can lead to false signals.
 * It’s particularly useful in volatile markets or when identifying shorter-term trading opportunities.
 *
 * @see https://en.wikipedia.org/wiki/Commodity_channel_index
 */
export class CCI extends BigIndicatorSeries<HighLowClose> {
  private readonly sma: SMA;
  private readonly typicalPrices: Big[];

  constructor(public readonly interval: number) {
    super();
    this.sma = new SMA(this.interval);
    this.typicalPrices = [];
  }

  override getRequiredInputs() {
    return this.sma.getRequiredInputs();
  }

  update(candle: HighLowClose, replace: boolean) {
    const typicalPrice = this.cacheTypicalPrice(candle, replace);
    this.sma.update(typicalPrice, replace);

    if (this.sma.isStable) {
      const mean = this.sma.getResultOrThrow();
      const meanDeviation = MAD.getResultFromBatch(this.typicalPrices, mean);
      const numerator = typicalPrice.minus(mean);
      const denominator = new Big(0.015).mul(meanDeviation);
      const result = numerator.div(denominator);
      return this.setResult(result, replace);
    }

    return null;
  }

  private cacheTypicalPrice({high, low, close}: HighLowClose, replace: boolean) {
    const typicalPrice = new Big(high).plus(low).plus(close).div(3);
    pushUpdate(this.typicalPrices, replace, typicalPrice, this.interval);
    return typicalPrice;
  }
}

export class FasterCCI extends NumberIndicatorSeries<HighLowClose<number>> {
  private readonly sma: FasterSMA;
  private readonly typicalPrices: number[];

  constructor(public readonly interval: number) {
    super();
    this.sma = new FasterSMA(this.interval);
    this.typicalPrices = [];
  }

  override getRequiredInputs() {
    return this.sma.getRequiredInputs();
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const typicalPrice = this.cacheTypicalPrice(candle, replace);
    this.sma.update(typicalPrice, replace);

    if (this.sma.isStable) {
      const mean = this.sma.getResultOrThrow();
      const meanDeviation = FasterMAD.getResultFromBatch(this.typicalPrices, mean);
      const numerator = typicalPrice - mean;
      const denominator = 0.015 * meanDeviation;
      return this.setResult(numerator / denominator, replace);
    }

    return null;
  }

  private cacheTypicalPrice({high, low, close}: HighLowClose<number>, replace: boolean) {
    const typicalPrice = (high + low + close) / 3;
    pushUpdate(this.typicalPrices, replace, typicalPrice, this.interval);
    return typicalPrice;
  }
}
