import {EMA} from '../EMA/EMA';
import Big, {BigSource} from 'big.js';
import {DEMA, NotEnoughDataError} from '..';

export type MACDConfig = {
  longInterval: number;
  shortInterval: number;
  signalInterval: number;
  useDEMA: boolean;
};

export type MACDResult = {
  diff: Big;
  macd: Big;
  signal: Big;
};

export class MACD {
  private readonly long: EMA | DEMA;
  private readonly short: EMA | DEMA;
  private readonly signal: EMA | DEMA;

  private age: number = 0;
  private result: MACDResult | undefined;

  constructor(private readonly config: MACDConfig) {
    this.long = config.useDEMA ? new DEMA(config.longInterval) : new EMA(config.longInterval);
    this.short = config.useDEMA ? new DEMA(config.shortInterval) : new EMA(config.shortInterval);
    this.signal = config.useDEMA ? new DEMA(config.signalInterval) : new EMA(config.signalInterval);
  }

  get isStable(): boolean {
    return this.age >= this.config.longInterval;
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

    /**
     * The MACD-Histogram represents the difference between MACD and its 9-day EMA, the signal line.
     */
    this.result = {
      diff: diff,
      macd: diff.sub(this.signal.getResult()),
      signal: this.signal.getResult(),
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
