import {EMA} from '../EMA/EMA';
import Big, {BigSource} from 'big.js';
import {DEMA, NotEnoughDataError} from '..';

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

export class MACD {
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
    return this.age >= Math.max(this.config.longInterval, this.config.shortInterval, this.config.signalInterval);
  }

  update(_price: BigSource): void {
    const price = new Big(_price);

    this.short.update(price);
    this.long.update(price);

    const shortEMA = this.short.getResult();
    const longEMA = this.long.getResult();

    /**
     * Standard MACD is the short (usually 12 periods) EMA less the long (usually 26 periods) EMA. Closing prices are
     * used to form the moving averages.
     */
    const diff = shortEMA.sub(longEMA);

    /**
     * A short (usually 9 periods) EMA of MACD is plotted along side to act as a signal line to identify turns in the
     * indicator.
     */
    this.signal.update(diff);

    const signal = this.signal.getResult();

    /**
     * The MACD-Histogram represents the difference between MACD and its 9-day EMA, the signal line.
     */
    this.result = {
      histogram: diff.sub(signal),
      macd: diff,
      signal,
    };

    this.age++;
  }

  getResult(): MACDResult {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }
}
