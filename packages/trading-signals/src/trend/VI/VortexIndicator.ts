import type {HighLowClose} from '../../base/Candle.type.js';
import {TechnicalIndicator, TradingSignal} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

export type VortexResult = {
  /** Downward movement line (VI−) */
  minus: number;
  /** Upward movement line (VI+) */
  plus: number;
};

/**
 * Vortex Indicator (VI)
 * Type: Trend
 *
 * The Vortex Indicator was developed by Etienne Botes and Douglas Siepman and published in the January 2010 issue of
 * "Technical Analysis of Stocks & Commodities". It draws two lines from the interplay of consecutive candles: VI+
 * captures upward trend movement as the reach from each candle's high back to the previous candle's low, while VI−
 * captures downward movement as the reach from each candle's low back to the previous candle's high. Both movement
 * sums are normalized by the total True Range of the interval, so the lines oscillate around 1.
 *
 * Interpretation: The upper line names the side in control — an uptrend when VI+ trades above VI−, a downtrend when
 * VI− trades above VI+. A crossover of the two lines suggests a trend change.
 *
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:vortex_indicator
 * @see https://www.investopedia.com/terms/v/vortex-indicator-vi.asp
 */
export class VortexIndicator extends TechnicalIndicator<VortexResult, HighLowClose<number>> {
  public readonly interval: number;
  readonly #candles: HighLowClose<number>[] = [];
  #previousResult?: VortexResult;

  constructor(interval: number = 14) {
    super();
    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval + 1;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.interval + 1, replace: replace});

    if (this.#candles.length <= this.interval) {
      return null;
    }

    let upwardMovement = 0;
    let downwardMovement = 0;
    let trueRange = 0;

    for (let i = 1; i < this.#candles.length; i++) {
      const current = this.#candles[i];
      const previous = this.#candles[i - 1];
      upwardMovement += Math.abs(current.high - previous.low);
      downwardMovement += Math.abs(current.low - previous.high);
      trueRange += Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      );
    }

    if (replace) {
      this.result = this.#previousResult;
    }

    this.#previousResult = this.result;

    /*
     * A window without any true range means the price never moved, so there is no movement to
     * attribute to either line. Reporting zero on both sides keeps a dead market sideways
     * instead of fabricating a direction from a division by zero.
     */
    if (trueRange === 0) {
      return (this.result = {
        minus: 0,
        plus: 0,
      });
    }

    return (this.result = {
      minus: downwardMovement / trueRange,
      plus: upwardMovement / trueRange,
    });
  }

  protected calculateSignal(result?: VortexResult | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isBullish = hasResult && result.plus > result.minus;
    const isBearish = hasResult && result.minus > result.plus;

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
