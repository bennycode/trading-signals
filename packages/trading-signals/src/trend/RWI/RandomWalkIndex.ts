import type {HighLowClose} from '../../base/Candle.type.js';
import {TradingSignal, TrendIndicator} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';
import {ATR} from '../../volatility/ATR/ATR.js';

export type RandomWalkIndexResult = {
  /** Trend strength of the upward path (RWI High) */
  high: number;
  /** Trend strength of the downward path (RWI Low) */
  low: number;
};

/**
 * Random Walk Index (RWI)
 * Type: Trend
 *
 * The Random Walk Index was developed by Michael Poulos and published in the 1991 "Technical Analysis of Stocks &
 * Commodities" article "Of Trends And Random Walks". It asks whether price covered more ground than a random walk
 * would have: over a stretch of candles, random noise drifts about the Average True Range times the square root of
 * the stretch length. RWI High relates the current high to the low at the start of a stretch, RWI Low relates the
 * current low to the high at the start of a stretch, and each line reports the strongest such ratio among all
 * stretches from two candles up to the configured interval (the scanning formulation, matching ta4j).
 *
 * Interpretation: Readings above 1 mark non-random movement — price travelled further than a random walk would
 * drift, so a trend is in force. The greater line names the side in control: an uptrend when RWI High trades above
 * RWI Low, a downtrend when RWI Low trades above RWI High.
 *
 * Note: The Average True Range in this implementation seeds Wilder's smoothing with a simple average of the first
 * true ranges, while ta4j seeds with the first true range alone. Both smoothings converge, but readings close to
 * the warm-up can differ slightly from ta4j.
 *
 * @see https://rtmath.net/helpFinAnalysis/html/934563a8-9171-42d2-8444-486691234b1d.html
 * @see https://github.com/ta4j/ta4j/blob/master/ta4j-core/src/main/java/org/ta4j/core/indicators/RWIHighIndicator.java
 * @see https://github.com/ta4j/ta4j/blob/master/ta4j-core/src/main/java/org/ta4j/core/indicators/RWILowIndicator.java
 */
export class RandomWalkIndex extends TrendIndicator<RandomWalkIndexResult, HighLowClose<number>> {
  public readonly interval: number;
  readonly #candles: HighLowClose<number>[] = [];
  readonly #atrs: ATR[] = [];
  readonly #randomWalkDrifts: number[] = [];

  constructor(interval: number = 14) {
    super();
    this.interval = interval;

    for (let stretch = 2; stretch <= interval; stretch++) {
      this.#atrs.push(new ATR(stretch));
      this.#randomWalkDrifts.push(Math.sqrt(stretch));
    }
  }

  /*
   * The longest stretch measures a full interval of true ranges, and the very first candle only
   * seeds the range comparison without contributing one — so one candle more than the interval
   * has to arrive before every stretch is measurable. The reference implementation emits its
   * first reading on exactly that candle.
   */
  override getRequiredInputs() {
    return this.interval + 1;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.interval + 1, replace: replace});

    for (const atr of this.#atrs) {
      atr.update(candle, replace);
    }

    if (this.#candles.length <= this.interval) {
      return null;
    }

    let high: number | undefined;
    let low: number | undefined;

    this.#atrs.forEach((atr, i) => {
      const averageTrueRange = atr.getResultOrThrow();

      /*
       * A market whose true range never moved has no volatility to walk with, so no stretch of
       * that market can be measured against a random walk. Skipping such stretches keeps a dead
       * market from fabricating a direction out of a division by zero.
       */
      if (averageTrueRange === 0) {
        return;
      }

      const stretch = i + 2;
      const expectedDrift = averageTrueRange * this.#randomWalkDrifts[i];
      const stretchStart = this.#candles[this.#candles.length - stretch];
      const rwiHigh = (candle.high - stretchStart.low) / expectedDrift;
      const rwiLow = (stretchStart.high - candle.low) / expectedDrift;
      high = high === undefined ? rwiHigh : Math.max(high, rwiHigh);
      low = low === undefined ? rwiLow : Math.max(low, rwiLow);
    });

    if (high === undefined || low === undefined) {
      return this.setResult(
        {
          high: 0,
          low: 0,
        },
        replace
      );
    }

    return this.setResult(
      {
        high,
        low,
      },
      replace
    );
  }

  protected calculateSignalState(result?: RandomWalkIndexResult | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isBullish = hasResult && result.high > result.low;
    const isBearish = hasResult && result.low > result.high;

    switch (true) {
      case !hasResult:
        return TradingSignal.UNKNOWN;
      case isBullish:
        return TradingSignal.BULLISH;
      case isBearish:
        return TradingSignal.BEARISH;
      default:
        return TradingSignal.SIDEWAYS;
    }
  }
}
