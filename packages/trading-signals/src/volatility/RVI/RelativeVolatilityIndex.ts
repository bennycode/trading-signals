import {ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {WSMA} from '../../trend/WSMA/WSMA.js';
import {getStandardDeviation, pushUpdate} from '../../util/index.js';

export type RelativeVolatilityIndexConfig = {
  /** Number of bars in the smoothing of the up/down volatility streams */
  interval?: number;
  signalThresholds?: SignalThresholds;
  /** Number of closes in the rolling window whose standard deviation is measured */
  stddevInterval?: number;
};

/**
 * Relative Volatility Index (RVI)
 * Type: Volatility
 *
 * Developed by Donald Dorsey and published in Technical Analysis of Stocks & Commodities (June 1993,
 * refined in 1995), the Relative Volatility Index applies the RSI recipe to volatility instead of price
 * change: each bar assigns the standard deviation of recent closes to an up stream when the close rises
 * and to a down stream when it falls (an unchanged close feeds neither), and both streams are smoothed
 * with Wilder's technique. The reading oscillates between 0 and 100 and expresses the share of recent
 * volatility that built up while prices were rising. Dorsey designed it as a confirmation filter that
 * qualifies signals of other indicators rather than generating trades on its own. Not to be confused
 * with the Relative Vigor Index (RVGI) or Relative Volume (RVOL).
 *
 * The deviation window uses the population standard deviation, matching TradingView's built-in RVI
 * (pandas-ta defaults to the sample variant and to EMA smoothing, so its readings differ slightly).
 *
 * Interpretation:
 * A value of 60 or above indicates volatility building on the upside (bullish pressure), a value of 40
 * or below volatility building on the downside (bearish pressure); both thresholds can be customized
 * via the constructor. A dead market produces no volatility in either direction, which offers nothing
 * to attribute to either side, so the reading is neutral (50).
 *
 * @see https://www.tradingview.com/support/solutions/43000594684-relative-volatility-index/
 * @see https://docs.motivewave.com/studies/q-r#relative-volatility-index
 */
export class RelativeVolatilityIndex extends ThresholdCrossSeries {
  readonly #closes: number[] = [];
  readonly #avgUpVolatility: WSMA;
  readonly #avgDownVolatility: WSMA;

  public readonly interval: number;
  public readonly stddevInterval: number;

  constructor({
    interval = 14,
    signalThresholds: {overbought = 60, oversold = 40} = {},
    stddevInterval = 10,
  }: RelativeVolatilityIndexConfig = {}) {
    super({overbought, oversold});

    // A single close carries no deviation and leaves no previous close to compare against
    if (stddevInterval < 2) {
      throw new Error(`The stddevInterval has to be at least 2, but "${stddevInterval}" was given.`);
    }

    this.interval = interval;
    this.stddevInterval = stddevInterval;
    this.#avgUpVolatility = new WSMA(interval);
    this.#avgDownVolatility = new WSMA(interval);
  }

  override getRequiredInputs() {
    // The smoothing only starts receiving volatility once the deviation window is full
    return this.stddevInterval + this.#avgUpVolatility.getRequiredInputs() - 1;
  }

  update(close: number, replace: boolean) {
    pushUpdate({array: this.#closes, item: close, maxLength: this.stddevInterval, replace});

    if (this.#closes.length < this.stddevInterval) {
      return null;
    }

    const previousClose = this.#closes[this.#closes.length - 2];
    const stddev = getStandardDeviation(this.#closes);

    this.#avgUpVolatility.update(close > previousClose ? stddev : 0, replace);
    this.#avgDownVolatility.update(close < previousClose ? stddev : 0, replace);

    if (this.#avgUpVolatility.isStable) {
      const upVolatility = this.#avgUpVolatility.getResultOrThrow();
      const downVolatility = this.#avgDownVolatility.getResultOrThrow();
      const totalVolatility = upVolatility + downVolatility;

      // A dead market offers no volatility to attribute to either side, so the reading is neutral
      if (totalVolatility === 0) {
        return this.setResult(50, replace);
      }

      return this.setResult((100 * upVolatility) / totalVolatility, replace);
    }

    return null;
  }
}
