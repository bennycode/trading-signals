import type {EMA, FasterEMA} from '../EMA/EMA.js';
import {Big, NotEnoughDataError, type BigSource, type DEMA, type FasterDEMA} from '../index.js';
import type {Indicator} from '../Indicator.js';

export type MACDConfig = {
  indicator: typeof EMA | typeof DEMA;
  longInterval: number;
  shortInterval: number;
  signalInterval: number;
};

export type MACDResult = {
  histogram: Big;
  macd: Big;
  signal: Big;
};

export type FasterMACDResult = {
  histogram: number;
  macd: number;
  signal: number;
};

/**
 * Moving Average Convergence Divergence (MACD)
 * Type: Momentum
 *
 * The MACD triggers trading signals when it crosses above (bullish buying opportunity) or below (bearish selling
 * opportunity) its signal line. MACD can be used together with the RSI to provide a more accurate trading signal.
 *
 * @see https://www.investopedia.com/terms/m/macd.asp
 */
export class MACD implements Indicator<MACDResult> {
  public readonly prices: BigSource[] = [];
  public readonly long: EMA | DEMA;
  public readonly short: EMA | DEMA;

  private readonly signal: EMA | DEMA;
  private result: MACDResult | undefined;

  constructor(config: MACDConfig) {
    this.long = new config.indicator(config.longInterval);
    this.short = new config.indicator(config.shortInterval);
    this.signal = new config.indicator(config.signalInterval);
  }

  get isStable(): boolean {
    return this.result !== undefined;
  }

  update(_price: BigSource, replace: boolean = false): void | MACDResult {
    const price = new Big(_price);
    if (this.prices.length && replace) {
      this.prices[this.prices.length - 1] = price;
    } else {
      this.prices.push(price);
    }

    const short = this.short.update(price, replace);
    const long = this.long.update(price, replace);

    if (this.prices.length > this.long.interval) {
      this.prices.shift();
    }

    if (this.prices.length === this.long.interval) {
      /**
       * Standard MACD is the short (usually 12 periods) EMA less the long (usually 26 periods) EMA. Closing prices are
       * used to form the moving averages.
       */
      const macd = short.sub(long);

      /**
       * A short (usually 9 periods) EMA of MACD is plotted along side to act as a signal line to identify turns in the
       * indicator. It gets updated once the long EMA has enough input data.
       */
      const signal = this.signal.update(macd);

      /**
       * The MACD histogram is calculated as the MACD indicator minus the signal line (usually 9 periods) EMA.
       */
      return (this.result = {
        histogram: macd.sub(signal),
        macd: macd,
        signal,
      });
    }
  }

  getResult(): MACDResult {
    if (!this.isStable || this.result === undefined) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }
}

export class FasterMACD implements Indicator<FasterMACDResult> {
  public readonly prices: number[] = [];
  private result: FasterMACDResult | undefined;

  constructor(
    public readonly short: FasterEMA | FasterDEMA,
    public readonly long: FasterEMA | FasterDEMA,
    public readonly signal: FasterEMA | FasterDEMA
  ) {}

  getResult(): FasterMACDResult {
    if (this.result === undefined) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  get isStable(): boolean {
    return this.result !== undefined;
  }

  update(price: number, replace: boolean = false): void | FasterMACDResult {
    if (this.prices.length && replace) {
      this.prices[this.prices.length - 1] = price;
    } else {
      this.prices.push(price);
    }

    const short = this.short.update(price, replace);
    const long = this.long.update(price, replace);

    if (this.prices.length > this.long.interval) {
      this.prices.shift();
    }

    if (this.prices.length === this.long.interval) {
      const macd = short - long;
      const signal = this.signal.update(macd, replace);

      return (this.result = {
        histogram: macd - signal,
        macd,
        signal,
      });
    }
  }
}
