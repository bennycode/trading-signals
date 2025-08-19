import type {DEMA} from '../../trend/DEMA/DEMA.js';
import type {EMA} from '../../trend/EMA/EMA.js';
import {TechnicalIndicator} from '../../types/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

export type MACDResult = {
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
export class MACD extends TechnicalIndicator<MACDResult, number> {
  public readonly prices: number[] = [];

  constructor(
    public readonly short: EMA | DEMA,
    public readonly long: EMA | DEMA,
    public readonly signal: EMA | DEMA
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
