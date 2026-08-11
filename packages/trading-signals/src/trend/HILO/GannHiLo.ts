import type {HighLowClose} from '../../base/Candle.type.js';
import {TechnicalIndicator, TradingSignal} from '../../base/Indicator.js';
import {SMA} from '../SMA/SMA.js';

export type GannHiLoResult = {
  /** The activator level price trails against: the average of the lows supports price in an uptrend, the average of the highs caps it in a downtrend */
  line: number;
  /** BULLISH while the line rides below price, BEARISH while it caps price from above */
  trend: typeof TradingSignal.BULLISH | typeof TradingSignal.BEARISH;
};

export type GannHiLoConfig = {
  /** Number of candles for the average of the highs that a close must clear to flip the trend up (default: 13) */
  highInterval?: number;
  /** Number of candles for the average of the lows that a close must break to flip the trend down (default: 21) */
  lowInterval?: number;
};

/**
 * Everything a replacement needs to rerun the latest candle: the averages that candle originally
 * broke out against and the line it would otherwise extend.
 */
type GannHiLoState = {
  hilo: GannHiLoResult | null;
  previousHighSma: number | null;
  previousHilo: GannHiLoResult | null;
  previousLowSma: number | null;
};

/**
 * Gann HiLo Activator (HILO)
 * Type: Trend
 *
 * Robert Krausz introduced the Gann HiLo Activator in a 1998 issue of "Technical Analysis of Stocks & Commodities"
 * and built his Gann swing trading plans around it in "A W.D. Gann Treasure Discovered". It tracks two simple moving
 * averages — one of the highs, one of the lows — and lets the close pick which of the two is plotted: a close above
 * the previous average of the highs activates the average of the lows as rising support, a close below the previous
 * average of the lows activates the average of the highs as falling resistance, and between the two averages the
 * line freezes at its last level, so a pullback never loosens the stop.
 *
 * Interpretation:
 * The trend is BULLISH while the line trails below price and BEARISH while it caps price from above. The line only
 * switches sides when the close breaks the opposite average, so a flip marks a potential trend change and the line
 * itself serves as a trailing stop-and-reverse level. Lengthening the high interval while shortening the low
 * interval favors short trades; the reverse favors longs.
 *
 * @see https://github.com/xgboosted/pandas-ta-classic/blob/main/pandas_ta_classic/overlap/hilo.py
 * @see https://www.sierrachart.com/index.php?page=doc/StudiesReference.php&ID=447&Name=Gann_HiLo_Activator
 */
export class GannHiLo extends TechnicalIndicator<GannHiLoResult, HighLowClose<number>, GannHiLoState> {
  readonly #highSma: SMA;
  readonly #lowSma: SMA;

  public readonly highInterval: number;
  public readonly lowInterval: number;

  protected override state: GannHiLoState = {
    hilo: null,
    previousHighSma: null,
    previousHilo: null,
    previousLowSma: null,
  };

  constructor({highInterval = 13, lowInterval = 21}: GannHiLoConfig = {}) {
    super();
    this.highInterval = highInterval;
    this.lowInterval = lowInterval;
    this.#highSma = new SMA(highInterval);
    this.#lowSma = new SMA(lowInterval);
  }

  override getRequiredInputs() {
    /*
     * The line first appears on a breakout candle: the broken average must be complete one candle
     * earlier, while the opposite average must be complete on the breakout candle itself to supply
     * the level. Whichever flip direction can complete first defines the warm-up.
     */
    const bullishBreakout = Math.max(this.highInterval + 1, this.lowInterval);
    const bearishBreakout = Math.max(this.lowInterval + 1, this.highInterval);

    return Math.min(bullishBreakout, bearishBreakout);
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    this.trackState(replace);

    const {hilo: previousHilo, previousHighSma, previousLowSma} = this.state;
    const highSma = this.#highSma.update(candle.high, replace);
    const lowSma = this.#lowSma.update(candle.low, replace);

    const brokeAboveHighAverage = previousHighSma !== null && candle.close > previousHighSma;
    const brokeBelowLowAverage = previousLowSma !== null && candle.close < previousLowSma;

    let hilo: GannHiLoResult | null;

    /*
     * An upside breakout takes precedence over a downside one, and a breakout whose activated
     * average has not formed yet plots nothing — the warm-up zone stays empty instead of
     * guessing a level, matching the reference implementation.
     */
    if (brokeAboveHighAverage) {
      hilo = lowSma === null ? null : {line: lowSma, trend: TradingSignal.BULLISH};
    } else if (brokeBelowLowAverage) {
      hilo = highSma === null ? null : {line: highSma, trend: TradingSignal.BEARISH};
    } else {
      // The close stayed between both averages, so the active side keeps control and the line freezes
      hilo = previousHilo;
    }

    this.state = {hilo, previousHighSma: highSma, previousHilo, previousLowSma: lowSma};
    this.result = hilo ?? undefined;

    return hilo;
  }

  protected calculateSignal(result: GannHiLoResult | null) {
    if (result === null) {
      return TradingSignal.UNKNOWN;
    }

    return result.trend;
  }

  getSignal() {
    const previousState = this.calculateSignal(this.state.previousHilo);
    const state = this.calculateSignal(this.getResult());
    const hasChanged = previousState !== state;

    return {
      hasChanged,
      state,
    };
  }
}
