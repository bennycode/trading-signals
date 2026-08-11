import type {HighLowClose} from '../../base/Candle.type.js';
import {TechnicalIndicator, TradingSignal} from '../../base/Indicator.js';
import {getAverage} from '../../util/getAverage.js';
import {pushUpdate} from '../../util/pushUpdate.js';
import {BollingerBands} from '../BBANDS/BollingerBands.js';
import {KeltnerChannels} from '../KC/KeltnerChannels.js';

export type TTMSqueezeResult = {
  /** `true` while the Bollinger Bands trade strictly inside the Keltner Channel */
  isSqueezed: boolean;
  /** Histogram value whose sign names the side positioned to receive the move once the squeeze fires */
  momentum: number;
};

export type TTMSqueezeConfig = {
  /** Number of candles for the Bollinger Bands (default: 20) */
  bbInterval?: number;
  /** How many standard deviations the Bollinger Bands sit away from their middle line (default: 2) */
  bbMultiplier?: number;
  /** Number of candles for the Keltner Channel and the momentum histogram (default: 20) */
  kcInterval?: number;
  /** How many ATRs the Keltner Channel lines sit away from the middle line (default: 1.5) */
  kcMultiplier?: number;
};

/**
 * TTM Squeeze / Squeeze Momentum (SQUEEZE)
 * Type: Volatility
 *
 * John Carter introduced the TTM Squeeze in "Mastering the Trade" to spot markets coiling up before
 * an explosive move: when the Bollinger Bands contract until they trade strictly inside the Keltner
 * Channel, volatility has compressed far below its usual range — the market is "squeezed". The
 * accompanying momentum histogram anchors the close to the midpoint between the Donchian midline
 * (average of highest high and lowest low) and the SMA, then fits a least-squares regression line
 * through those distances and reads it at the newest candle. This implementation follows LazyBear's
 * public Pine Script formulation of the momentum histogram; the envelopes reuse this library's
 * Bollinger Bands and Keltner Channels, so the channel middle line is an EMA and its width follows
 * a Wilder-smoothed ATR (LazyBear's port smooths both with SMAs instead).
 *
 * Interpretation: A squeeze marks the quiet phase that tends to precede an outsized move, not the
 * move itself. The momentum histogram names the side positioned to receive that move — positive
 * momentum reads as bullish pressure, negative as bearish. The squeeze state is reported in the
 * result; the signal reflects only the momentum direction.
 *
 * @see https://www.tradingview.com/script/nqQ1DT5a-Squeeze-Momentum-Indicator-LazyBear/
 * @see https://pastebin.com/UCpcX8d7
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:ttm_squeeze
 */
export class TTMSqueeze extends TechnicalIndicator<TTMSqueezeResult, HighLowClose<number>> {
  public readonly bbInterval: number;
  public readonly bbMultiplier: number;
  public readonly kcInterval: number;
  public readonly kcMultiplier: number;

  readonly #bollinger: BollingerBands;
  readonly #keltner: KeltnerChannels;
  readonly #candles: HighLowClose<number>[] = [];
  readonly #anchoredDistances: number[] = [];
  #previousResult?: TTMSqueezeResult;

  constructor({bbInterval = 20, bbMultiplier = 2, kcInterval = 20, kcMultiplier = 1.5}: TTMSqueezeConfig = {}) {
    super();
    this.bbInterval = bbInterval;
    this.bbMultiplier = bbMultiplier;
    this.kcInterval = kcInterval;
    this.kcMultiplier = kcMultiplier;
    this.#bollinger = new BollingerBands(bbInterval, bbMultiplier);
    this.#keltner = new KeltnerChannels({atrInterval: kcInterval, emaInterval: kcInterval, multiplier: kcMultiplier});
  }

  override getRequiredInputs() {
    /*
     * The histogram warms up last: its anchor needs a full candle window and the regression then
     * needs a full window of anchored distances on top of that.
     */
    const momentumWarmUp = 2 * this.kcInterval - 1;

    return Math.max(this.#bollinger.getRequiredInputs(), this.#keltner.getRequiredInputs(), momentumWarmUp);
  }

  /**
   * Fits a least-squares line through the anchored distances and reads it at the newest candle.
   * Computed locally instead of reusing the linear-regression indicator, because that one projects
   * the line one candle ahead and short-circuits windows climbing in unit steps with a projection
   * that lands one candle short — either quirk would distort the histogram of a steadily trending
   * market.
   */
  #regressionValue(window: readonly number[]) {
    const n = window.length;
    let sumY = 0;
    let sumXY = 0;

    for (let x = 0; x < n; x++) {
      sumY += window[x];
      sumXY += x * window[x];
    }

    const sumX = ((n - 1) * n) / 2;
    const sumXX = ((n - 1) * n * (2 * n - 1)) / 6;
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return slope * (n - 1) + intercept;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const bollinger = this.#bollinger.update(candle.close, replace);
    const keltner = this.#keltner.update(candle, replace);

    pushUpdate({array: this.#candles, item: candle, maxLength: this.kcInterval, replace: replace});

    if (this.#candles.length === this.kcInterval) {
      const highestHigh = Math.max(...this.#candles.map(({high}) => high));
      const lowestLow = Math.min(...this.#candles.map(({low}) => low));
      const donchianMidline = (highestHigh + lowestLow) / 2;
      const averageClose = getAverage(this.#candles.map(({close}) => close));
      const anchor = (donchianMidline + averageClose) / 2;
      pushUpdate({
        array: this.#anchoredDistances,
        item: candle.close - anchor,
        maxLength: this.kcInterval,
        replace: replace,
      });
    }

    if (bollinger === null || keltner === null || this.#anchoredDistances.length < this.kcInterval) {
      return null;
    }

    if (replace) {
      this.result = this.#previousResult;
    }

    this.#previousResult = this.result;

    return (this.result = {
      isSqueezed: bollinger.upper < keltner.upper && bollinger.lower > keltner.lower,
      momentum: this.#regressionValue(this.#anchoredDistances),
    });
  }

  protected calculateSignal(result?: TTMSqueezeResult | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isBullish = hasResult && result.momentum > 0;
    const isBearish = hasResult && result.momentum < 0;

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

  getSignal(): {
    state: (typeof TradingSignal)[keyof typeof TradingSignal];
    hasChanged: boolean;
  } {
    const previousState = this.calculateSignal(this.#previousResult);
    const state = this.calculateSignal(this.getResult());
    const hasChanged = previousState !== state;

    return {
      hasChanged,
      state,
    };
  }
}
