import {ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

/**
 * Rank Correlation Index (RCI)
 * Type: Momentum
 *
 * The Rank Correlation Index applies Spearman's rank correlation to price and time: over the
 * last "interval" closes it ranks each bar by recency and by price, then measures how well the
 * two rankings agree. A market that closes higher every single bar has perfectly matching
 * rankings and reads +100, a market that closes lower every bar reads -100, and a directionless
 * market hovers around 0. Because only ranks matter, a creeping trend of tiny gains registers
 * just as strongly as a runaway rally — the RCI measures the consistency of a trend, not its
 * magnitude. It is a staple on Japanese trading platforms, typically plotted with intervals of
 * 9 (short), 26 (medium) and 52 (long).
 *
 * Ranking convention: the newest bar gets time rank 1 and the highest close gets price rank 1,
 * so a steady climb pairs the newest bars with the highest closes and reads +100 — the direction
 * Japanese charting platforms expect. Equal closes share the average of the rank positions they
 * occupy (standard Spearman tie handling).
 *
 * Interpretation:
 * An RCI of +80 or above indicates an overbought condition, -80 or below indicates an oversold
 * condition (both thresholds can be customized via the constructor). Readings pinned near the
 * extremes signal a persistent trend; a turn away from an extreme is commonly read as the trend
 * losing consistency.
 *
 * @see https://info.monex.co.jp/technical-analysis/indicators/017.html
 * @see https://github.com/StockSharp/StockSharp/blob/master/Algo.Indicators/RankCorrelationIndex.cs
 * @see https://strategyquant.com/codebase/rci3lines/
 */
export class RCI extends ThresholdCrossSeries {
  readonly #closes: number[] = [];

  public readonly interval: number;

  constructor(interval: number = 9, {overbought = 80, oversold = -80}: SignalThresholds = {}) {
    super({overbought, oversold});

    // A single-bar window has no rank order to correlate and would divide by zero
    if (!Number.isFinite(interval) || interval < 2) {
      throw new Error(`The interval has to be at least 2, but "${interval}" was given.`);
    }

    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(close: number, replace: boolean) {
    pushUpdate({array: this.#closes, item: close, maxLength: this.interval, replace: replace});

    if (this.#closes.length < this.interval) {
      return null;
    }

    const n = this.interval;
    let squaredRankDistances = 0;

    for (let i = 0; i < n; i++) {
      const timeRank = n - i;
      let higherCloses = 0;
      let equalCloses = 0;

      for (const other of this.#closes) {
        if (other > this.#closes[i]) {
          higherCloses++;
        } else if (other === this.#closes[i]) {
          equalCloses++;
        }
      }

      // Ties occupy a block of consecutive rank positions and each receives the block's average
      const priceRank = higherCloses + (equalCloses + 1) / 2;

      squaredRankDistances += (timeRank - priceRank) ** 2;
    }

    const rci = (1 - (6 * squaredRankDistances) / (n * (n ** 2 - 1))) * 100;

    return this.setResult(rci, replace);
  }
}
