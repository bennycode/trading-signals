import {EMA} from '../EMA/EMA';
import Big, {BigSource} from 'big.js';
import {DEMA, NotEnoughDataError} from '..';
import {Indicator} from '../Indicator';

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

/**
 * Moving Average Convergence Divergence (MACD)
 * Type: Momentum
 *
 * The MACD triggers trading signals when it crosses above (bullish buying opportunity) or below (bearish selling opportunity) its signal line. MACD can be used together with the RSI to provide a more accurate trading signal.
 *
 * @see https://www.investopedia.com/terms/m/macd.asp
 */
export class MACD implements Indicator<MACDResult> {
  public readonly long: EMA | DEMA;
  public readonly short: EMA | DEMA;

  private readonly signal: EMA | DEMA;
  private age: number = 0;
  private result: MACDResult | undefined;

  constructor(private readonly config: MACDConfig) {
    this.long = new config.indicator(config.longInterval);
    this.short = new config.indicator(config.shortInterval);
    this.signal = new config.indicator(config.signalInterval);
  }

  get isStable(): boolean {
    return this.age >= this.config.longInterval;
  }

  update(_price: BigSource): void {
    const price = new Big(_price);

    const shortEMA = this.short.update(price);
    const longEMA = this.long.update(price);
    this.age++;

    /**
     * Standard MACD is the short (usually 12 periods) EMA less the long (usually 26 periods) EMA. Closing prices are
     * used to form the moving averages.
     */
    const macd = shortEMA.sub(longEMA);

    /**
     * A short (usually 9 periods) EMA of MACD is plotted along side to act as a signal line to identify turns in the
     * indicator. It gets updated once the long EMA has enough input data.
     */
    const signalLine = this.isStable ? this.signal.update(macd) : new Big(0);

    /**
     * The MACD histogram is calculated as the MACD indicator minus the signal line (usually 9 periods) EMA.
     */
    this.result = {
      histogram: macd.sub(signalLine),
      macd: macd,
      signal: signalLine,
    };
  }

  getResult(): MACDResult {
    if (!this.isStable || !this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }
}
