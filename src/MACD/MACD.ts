import type {BigSource} from 'big.js';
import Big from 'big.js';
import type {DEMA, FasterDEMA} from '../DEMA/DEMA.js';
import type {EMA, FasterEMA} from '../EMA/EMA.js';
import {TechnicalIndicator} from '../Indicator.js';
import {pushUpdate} from '../util/pushUpdate.js';

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
export class MACD extends TechnicalIndicator<MACDResult, BigSource> {
  public readonly prices: BigSource[] = [];
  public readonly long: EMA | DEMA;
  public readonly short: EMA | DEMA;

  private readonly signal: EMA | DEMA;

  constructor(config: MACDConfig) {
    super();
    this.long = new config.indicator(config.longInterval);
    this.short = new config.indicator(config.shortInterval);
    this.signal = new config.indicator(config.signalInterval);
  }

  override getRequiredInputs() {
    return this.long.getRequiredInputs();
  }

  update(_price: BigSource, replace: boolean) {
    const price = new Big(_price);
    pushUpdate(this.prices, replace, price, this.long.interval);

    const short = this.short.update(price, replace);
    const long = this.long.update(price, replace);

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
      const signal = this.signal.update(macd, replace);

      /**
       * The MACD histogram is calculated as the MACD indicator minus the signal line (usually 9 periods) EMA.
       */
      return (this.result = {
        histogram: macd.sub(signal),
        macd: macd,
        signal,
      });
    }
    return null;
  }
}

export class FasterMACD extends TechnicalIndicator<FasterMACDResult, number> {
  public readonly prices: number[] = [];

  constructor(
    public readonly short: FasterEMA | FasterDEMA,
    public readonly long: FasterEMA | FasterDEMA,
    public readonly signal: FasterEMA | FasterDEMA
  ) {
    super();
  }

  override getRequiredInputs() {
    return this.long.getRequiredInputs();
  }

  update(price: number, replace: boolean) {
    pushUpdate(this.prices, replace, price, this.long.interval);

    const short = this.short.update(price, replace);
    const long = this.long.update(price, replace);

    if (this.prices.length === this.long.interval) {
      const macd = short - long;
      const signal = this.signal.update(macd, replace);

      return (this.result = {
        histogram: macd - signal,
        macd,
        signal,
      });
    }
    return null;
  }
}
