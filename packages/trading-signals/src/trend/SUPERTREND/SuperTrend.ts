import type {HighLowClose} from '../../base/Candle.type.js';
import {TechnicalIndicator, TradingSignal} from '../../base/Indicator.js';
import {ATR} from '../../volatility/ATR/ATR.js';

export type SuperTrendResult = {
  /** The active band price trails against: support below price in an uptrend, resistance above it in a downtrend */
  supertrend: number;
  /** BULLISH while the line rides below price, BEARISH while it caps price from above */
  trend: typeof TradingSignal.BULLISH | typeof TradingSignal.BEARISH;
};

export type SuperTrendConfig = {
  /** Number of candles for the ATR that sets the band distance (default: 10) */
  interval?: number;
  /** How many ATRs the band sits away from the candle midpoint (default: 3) */
  multiplier?: number;
};

type SuperTrendState = {
  close: number;
  finalLowerBand: number;
  finalUpperBand: number;
  isUp: boolean;
};

/**
 * SuperTrend (SUPERTREND)
 * Type: Trend
 *
 * Popularized by Olivier Seban, the SuperTrend answers the one question a trend follower keeps asking: which side of
 * the market to be on right now. It plots a single ATR-based band that trails below price in an uptrend and above it
 * in a downtrend, and because the band only ratchets in the direction of the trend (it never loosens), it doubles as
 * a volatility-adjusted trailing stop — wide in turbulent markets, tight in quiet ones.
 *
 * Interpretation:
 * The trend is BULLISH while price closes above the line and BEARISH while price closes below it. The line flips
 * sides only when the close breaks through the active band, so a flip marks a potential trend reversal. Like most
 * trend followers, it whipsaws in sideways markets and shines in trending ones.
 *
 * @see https://www.tradingview.com/support/solutions/43000634738-supertrend/
 * @see https://trendspider.com/learning-center/supertrend-indicator-a-comprehensive-guide/
 */
export class SuperTrend extends TechnicalIndicator<SuperTrendResult, HighLowClose<number>> {
  readonly #atr: ATR;
  #state?: SuperTrendState;
  /** One-deep undo snapshot so `replace()` can rewind the recursive band/trend state */
  #previousState?: SuperTrendState;

  public readonly interval: number;
  public readonly multiplier: number;

  constructor({interval = 10, multiplier = 3}: SuperTrendConfig = {}) {
    super();
    this.interval = interval;
    this.multiplier = multiplier;
    this.#atr = new ATR(interval);
  }

  override getRequiredInputs() {
    return this.#atr.getRequiredInputs();
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    if (replace) {
      this.#state = this.#previousState;
    }

    const atr = this.#atr.update(candle, replace);

    if (atr === null) {
      return null;
    }

    const hl2 = (candle.high + candle.low) / 2;
    const basicUpperBand = hl2 + this.multiplier * atr;
    const basicLowerBand = hl2 - this.multiplier * atr;

    const previous = this.#state;
    let finalUpperBand: number;
    let finalLowerBand: number;
    let isUp: boolean;

    if (previous === undefined) {
      finalUpperBand = basicUpperBand;
      finalLowerBand = basicLowerBand;
      isUp = candle.close > finalUpperBand;
    } else {
      finalUpperBand =
        basicUpperBand < previous.finalUpperBand || previous.close > previous.finalUpperBand
          ? basicUpperBand
          : previous.finalUpperBand;
      finalLowerBand =
        basicLowerBand > previous.finalLowerBand || previous.close < previous.finalLowerBand
          ? basicLowerBand
          : previous.finalLowerBand;
      isUp = previous.isUp ? candle.close >= finalLowerBand : candle.close > finalUpperBand;
    }

    this.#previousState = previous;
    this.#state = {close: candle.close, finalLowerBand, finalUpperBand, isUp};

    return (this.result = {
      supertrend: isUp ? finalLowerBand : finalUpperBand,
      trend: isUp ? TradingSignal.BULLISH : TradingSignal.BEARISH,
    });
  }
}
