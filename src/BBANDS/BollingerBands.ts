import Big, {BigSource} from 'big.js';
import {SMA} from '../SMA/SMA';
import {NotEnoughDataError} from '../error';
import {BandsResult} from '../util/BandsResult';
import {Indicator} from '../Indicator';
import {getAverage} from '../util/getAverage';

/**
 * Bollinger Bands (BBANDS)
 * Type: Volatility
 *
 * Bollinger bands are set as an envelope around a moving average. Narrow bands indicate a sideways trend (ranging
 * markets). To determine a breakout direction, [Investopia.com
 * suggests](https://www.investopedia.com/articles/technical/04/030304.asp) to use the relative strength index (RSI)
 * along with one or two volume-based indicators such as the intraday intensity index (developed by David Bostian) or
 * the accumulation/distribution index (developed by Larry William).
 *
 * When the upper and lower bands expand, there can be "M" and "W" formations. The "W" formation indicates a bullish
 * movement and the "M" formation indicates a bearish movement.
 *
 * @see https://www.investopedia.com/terms/b/bollingerbands.asp
 */
export class BollingerBands implements Indicator<BandsResult> {
  public readonly prices: Big[] = [];
  private result: BandsResult | undefined;

  constructor(public readonly interval: number = 0, public readonly deviationMultiplier: number = 2) {}

  get isStable(): boolean {
    return this.prices.length >= this.interval;
  }

  update(price: BigSource): void {
    this.prices.push(new Big(price));

    while (this.prices.length > this.interval) {
      this.prices.shift();
    }

    if (!this.isStable) {
      return;
    }

    const middle = SMA.getResultFromBatch(this.prices);
    const squareDiffs = this.prices.map((price: Big) => price.sub(middle).pow(2));
    const standardDeviation = getAverage(squareDiffs).sqrt();

    this.result = {
      lower: middle.sub(standardDeviation.times(this.deviationMultiplier)),
      middle,
      upper: middle.add(standardDeviation.times(this.deviationMultiplier)),
    };
  }

  getResult(): BandsResult {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }
}
