import {Big, type BigSource} from '../index.js';
import {MovingAverage} from '../MA/MovingAverage.js';
import {FasterSMA, SMA} from '../SMA/SMA.js';
import {NumberIndicatorSeries} from '../Indicator.js';

/**
 * Wilder's Smoothed Moving Average (WSMA)
 * Type: Trend
 *
 * Developed by **John Welles Wilder, Jr.** to help identifying and spotting bullish and bearish trends. Similar to
 * Exponential Moving Averages with the difference that a smoothing factor of 1/interval is being used, which makes it
 * respond more slowly to price changes.
 *
 * Synonyms:
 * - Modified Exponential Moving Average (MEMA)
 * - Smoothed Moving Average (SMMA)
 * - Welles Wilder's Smoothing (WWS)
 * - Wilder's Moving Average (WMA)
 *
 * @see https://tlc.thinkorswim.com/center/reference/Tech-Indicators/studies-library/V-Z/WildersSmoothing
 */
export class WSMA extends MovingAverage {
  private readonly indicator: SMA;
  private readonly smoothingFactor: Big;

  constructor(public readonly interval: number) {
    super(interval);
    this.indicator = new SMA(interval);
    this.smoothingFactor = new Big(1).div(this.interval);
  }

  updates(prices: BigSource[]): Big | void {
    prices.forEach(price => this.update(price));
    return this.result;
  }

  update(price: BigSource, replace: boolean = false): Big | void {
    const sma = this.indicator.update(price, replace);
    if (replace && this.previousResult) {
      const smoothed = new Big(price).minus(this.previousResult).mul(this.smoothingFactor);
      return this.setResult(smoothed.plus(this.previousResult), replace);
    } else if (!replace && this.result) {
      const smoothed = new Big(price).minus(this.result).mul(this.smoothingFactor);
      return this.setResult(smoothed.plus(this.result), replace);
    } else if (this.result === undefined && sma) {
      return this.setResult(sma, replace);
    }
  }
}

export class FasterWSMA extends NumberIndicatorSeries {
  private readonly indicator: FasterSMA;
  private readonly smoothingFactor: number;

  constructor(public readonly interval: number) {
    super();
    this.indicator = new FasterSMA(interval);
    this.smoothingFactor = 1 / this.interval;
  }

  updates(prices: number[]): number | void {
    prices.forEach(price => this.update(price));
    return this.result;
  }

  update(price: number, replace: boolean = false): number | void {
    const sma = this.indicator.update(price);
    if (replace && this.previousResult !== undefined) {
      const smoothed = (price - this.previousResult) * this.smoothingFactor;
      return this.setResult(smoothed + this.previousResult, replace);
    } else if (!replace && this.result !== undefined) {
      const smoothed = (price - this.result) * this.smoothingFactor;
      return this.setResult(smoothed + this.result, replace);
    } else if (this.result === undefined && sma !== undefined) {
      return this.setResult(sma, replace);
    }
  }
}
