import {ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

export type STCConfig = {
  /** Number of readings in the window of both stochastic scalings (default: 10) */
  cycleInterval?: number;
  /** Number of candles for the fast EMA of the underlying MACD line (default: 23) */
  fastInterval?: number;
  signalThresholds?: SignalThresholds;
  /** Number of candles for the slow EMA of the underlying MACD line (default: 50) */
  slowInterval?: number;
};

/**
 * Locates the latest reading within the range of its window on a 0-100 scale. A window whose
 * readings are all equal offers no range to locate the latest reading in, so it reads neutral.
 */
function stochasticPosition(window: readonly number[]) {
  const latest = window[window.length - 1];
  const highest = Math.max(...window);
  const lowest = Math.min(...window);

  if (highest === lowest) {
    return 50;
  }

  return (100 * (latest - lowest)) / (highest - lowest);
}

/**
 * Schaff Trend Cycle (STC)
 * Type: Momentum
 *
 * Developed by the currency trader Doug Schaff, the Schaff Trend Cycle treats the MACD line as
 * a cycling series and runs it through two rounds of stochastic scaling: the MACD is located
 * within its recent range on a 0-100 scale, that reading is smoothed by carrying half of every
 * change, and the outcome is located and smoothed once more. The double pass completes its
 * swings between 0 and 100 well before the MACD it is built on turns, which is why the STC is
 * popular for timing entries in fast-moving markets such as FX.
 *
 * Interpretation:
 * A value of 75 or above indicates an overbought market and 25 or below an oversold market
 * (both thresholds can be customized via the constructor). A scaling window whose readings are
 * all equal reads neutral (50), so a dead market never fabricates a directional reading.
 *
 * All smoothing stages seed with their first input (this library's convention). Note that
 * Skender.Stock.Indicators ships a simplified STC (a single SMA-smoothed stochastic pass over
 * the MACD), so its readings are not comparable.
 *
 * @see https://www.investopedia.com/articles/forex/10/schaff-trend-cycle-indicator.asp
 */
export class STC extends ThresholdCrossSeries {
  readonly #fastEma: EMA;
  readonly #slowEma: EMA;
  readonly #dSmoothing: EMA;
  readonly #stcSmoothing: EMA;
  readonly #macdWindow: number[] = [];
  readonly #dWindow: number[] = [];

  public readonly cycleInterval: number;
  public readonly fastInterval: number;
  public readonly slowInterval: number;

  constructor({
    cycleInterval = 10,
    fastInterval = 23,
    signalThresholds: {overbought = 75, oversold = 25} = {},
    slowInterval = 50,
  }: STCConfig = {}) {
    super({overbought, oversold});

    // A window of a single reading offers no range to locate that reading in
    if (cycleInterval < 2) {
      throw new Error(`The cycle interval has to be at least 2, but "${cycleInterval}" was given.`);
    }

    this.cycleInterval = cycleInterval;
    this.fastInterval = fastInterval;
    this.slowInterval = slowInterval;
    this.#fastEma = new EMA(fastInterval);
    this.#slowEma = new EMA(slowInterval);
    /*
     * Schaff smooths both cycle stages by carrying half of every change into the running value.
     * An EMA spanning three readings weighs incoming values at exactly one half, so it provides
     * that smoothing along with the bookkeeping to replace the latest reading.
     */
    this.#dSmoothing = new EMA(3);
    this.#stcSmoothing = new EMA(3);
  }

  override getRequiredInputs() {
    // Both EMAs have to be warm before the first MACD reading, then each scaling window fills up
    return Math.max(this.fastInterval, this.slowInterval) + 2 * (this.cycleInterval - 1);
  }

  update(price: number, replace: boolean) {
    const fastEma = this.#fastEma.update(price, replace);
    const slowEma = this.#slowEma.update(price, replace);

    if (!this.#fastEma.isStable || !this.#slowEma.isStable) {
      return null;
    }

    const macd = fastEma - slowEma;

    pushUpdate({array: this.#macdWindow, item: macd, maxLength: this.cycleInterval, replace});

    if (this.#macdWindow.length < this.cycleInterval) {
      return null;
    }

    const stochD = this.#dSmoothing.update(stochasticPosition(this.#macdWindow), replace);

    pushUpdate({array: this.#dWindow, item: stochD, maxLength: this.cycleInterval, replace});

    if (this.#dWindow.length < this.cycleInterval) {
      return null;
    }

    return this.setResult(this.#stcSmoothing.update(stochasticPosition(this.#dWindow), replace), replace);
  }
}
