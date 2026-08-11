import type {OpenHighLowClose} from '../../base/Candle.type.js';
import {TradingSignal, TrendIndicator} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

export type RelativeVigorIndexResult = {
  /** Main line: how much of the traded range the closes actually captured */
  rvgi: number;
  /** Smoothed copy of the main line that crossovers are read against */
  signal: number;
};

/**
 * Relative Vigor Index (RVGI)
 * Type: Momentum
 *
 * The Relative Vigor Index was developed by John Ehlers and published in the January 2002 issue of "Technical
 * Analysis of Stocks & Commodities". It builds on the observation that a rising market tends to close above its
 * open while a falling market closes below it. Each candle body is smoothed with symmetric four-bar weights and
 * measured against the equally smoothed trading range, so the index expresses how much of the available range the
 * closes actually captured — the "vigor" of the move. The signal line applies the same four-bar smoothing to the
 * index itself, making it trail the index while momentum builds.
 *
 * Interpretation: The index trading above its signal line marks bullish pressure, below it bearish pressure.
 * Crossovers of the two lines suggest a momentum change.
 *
 * @see https://www.tradingview.com/support/solutions/43000591593-relative-vigor-index/
 * @see https://www.investopedia.com/terms/r/relative_vigor_index.asp
 */
export class RelativeVigorIndex extends TrendIndicator<RelativeVigorIndexResult, OpenHighLowClose<number>> {
  public readonly interval: number;
  readonly #candles: OpenHighLowClose<number>[] = [];

  constructor(interval: number = 10) {
    super();
    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval + 6;
  }

  update(candle: OpenHighLowClose<number>, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.getRequiredInputs(), replace: replace});

    if (this.#candles.length < this.getRequiredInputs()) {
      return null;
    }

    const bodies = this.#candles.map(({close, open}) => close - open);
    const ranges = this.#candles.map(({high, low}) => high - low);
    const swma = (values: readonly number[], end: number) =>
      (values[end] + 2 * values[end - 1] + 2 * values[end - 2] + values[end - 3]) / 6;

    const vigorAt = (end: number) => {
      let smoothedBodies = 0;
      let smoothedRanges = 0;

      for (let i = end - this.interval + 1; i <= end; i++) {
        smoothedBodies += swma(bodies, i);
        smoothedRanges += swma(ranges, i);
      }

      /*
       * A window of flat candles offers no trading range to capture, so there is no vigor to
       * measure. Reporting zero keeps a dead market sideways instead of fabricating a direction
       * from a division by zero.
       */
      if (smoothedRanges === 0) {
        return 0;
      }

      return smoothedBodies / smoothedRanges;
    };

    const newest = this.#candles.length - 1;
    const rvgi = vigorAt(newest);
    const signal = (rvgi + 2 * vigorAt(newest - 1) + 2 * vigorAt(newest - 2) + vigorAt(newest - 3)) / 6;

    return this.setResult(
      {
        rvgi,
        signal,
      },
      replace
    );
  }

  protected calculateSignalState(result?: RelativeVigorIndexResult | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isBullish = hasResult && result.rvgi > result.signal;
    const isBearish = hasResult && result.rvgi < result.signal;

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
