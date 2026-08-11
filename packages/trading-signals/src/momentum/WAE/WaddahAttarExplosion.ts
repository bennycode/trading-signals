import type {HighLowClose} from '../../base/Candle.type.js';
import {TradingSignal, TrendIndicator} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {ATR} from '../../volatility/ATR/ATR.js';
import {BollingerBands} from '../../volatility/BBANDS/BollingerBands.js';
import {MACD} from '../MACD/MACD.js';

export type WaddahAttarExplosionResult = {
  /** Noise floor: as long as the explosion stays at or below this level, the move counts as noise, not as tradable */
  deadZone: number;
  /** Energy of the current move, measured as the full width of the volatility channel */
  explosion: number;
  /** Signed thrust of the move: positive pushes up, negative pushes down */
  trend: number;
};

export type WaddahAttarExplosionConfig = {
  /** Lookback of the volatility average behind the dead zone. SHK default: 100 */
  atrInterval?: number;
  /** Lookback of the volatility channel behind the explosion. SHK default: 20 */
  bandsInterval?: number;
  /** Width factor of the volatility channel. SHK default: 2 */
  bandsMultiplier?: number;
  /** Scales the volatility average up to the noise floor. SHK default: 3.7 */
  deadZoneMultiplier?: number;
  /** Lookback of the slow average behind the trend thrust. SHK default: 40 */
  longInterval?: number;
  /** Scales the bar-over-bar thrust into a plottable magnitude. SHK default: 150 */
  sensitivity?: number;
  /** Lookback of the fast average behind the trend thrust. SHK default: 20 */
  shortInterval?: number;
};

/**
 * Waddah Attar Explosion (WAE)
 * Type: Momentum
 *
 * Created by Waddah Attar for MetaTrader and popularized through LazyBear's TradingView port, the indicator answers
 * one question: is there enough energy in the market to make a move worth trading, and in which direction? It combines
 * three readings per candle: the trend (the bar-over-bar change of the MACD line, scaled by a sensitivity factor), the
 * explosion (the width of the Bollinger Bands, i.e. how much volatility the move carries) and the dead zone (an
 * ATR-based noise floor below which volatility is considered meaningless).
 *
 * This implementation pins the "Waddah Attar Explosion V2 [SHK]" formulation, whose ATR-based dead zone adapts to the
 * instrument's price scale instead of relying on a fixed pip threshold: the trend is the one-bar change of a 20/40 EMA
 * spread scaled by 150, the explosion is the width of Bollinger Bands over 20 candles with 2 standard deviations, and
 * the dead zone is the Wilder-smoothed True Range over 100 candles multiplied by 3.7. One deviation from the Pine
 * original: instead of zero-filling the dead zone while its volatility average is still warming up, no result is
 * produced until every component is warmed up, so an unfinished noise floor never fabricates an "explosion".
 *
 * Interpretation: Trade only on explosion. When the explosion rises above the dead zone, the market offers enough
 * energy for a move, and the sign of the trend names its direction (bullish above zero, bearish below). While the
 * explosion stays at or below the dead zone, any trend reading counts as noise and the market is treated as sideways.
 *
 * @see https://www.tradingview.com/script/d9IjcYyS-Waddah-Attar-Explosion-V2-SHK/
 * @see https://www.tradingview.com/script/iu3kKWDI-Waddah-Attar-Explosion-LazyBear/
 */
export class WaddahAttarExplosion extends TrendIndicator<WaddahAttarExplosionResult, HighLowClose<number>> {
  public readonly deadZoneMultiplier: number;
  public readonly sensitivity: number;

  readonly #atr: ATR;
  readonly #bands: BollingerBands;
  readonly #macd: MACD;

  #currentMacd?: number;
  #previousMacd?: number;

  constructor({
    atrInterval = 100,
    bandsInterval = 20,
    bandsMultiplier = 2,
    deadZoneMultiplier = 3.7,
    longInterval = 40,
    sensitivity = 150,
    shortInterval = 20,
  }: WaddahAttarExplosionConfig = {}) {
    super();
    this.deadZoneMultiplier = deadZoneMultiplier;
    this.sensitivity = sensitivity;
    this.#atr = new ATR(atrInterval);
    this.#bands = new BollingerBands(bandsInterval, bandsMultiplier);
    /*
     * Waddah Attar reads only the spread between the fast and the slow average. The crossover line a
     * classic MACD carries plays no role here, so it is kept at a one-bar length where it merely
     * mirrors the spread.
     */
    this.#macd = new MACD(new EMA(shortInterval), new EMA(longInterval), new EMA(1));
  }

  override getRequiredInputs() {
    return Math.max(this.#macd.getRequiredInputs() + 1, this.#bands.getRequiredInputs(), this.#atr.getRequiredInputs());
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const macd = this.#macd.update(candle.close, replace);
    const bands = this.#bands.update(candle.close, replace);
    const atr = this.#atr.update(candle, replace);

    /*
     * The thrust compares the current average spread with the spread one bar earlier. A replacement
     * discards the reading of the bar being replaced, so the comparison base has to be the spread
     * from before that bar.
     */
    if (replace) {
      this.#currentMacd = this.#previousMacd;
    }

    this.#previousMacd = this.#currentMacd;
    this.#currentMacd = macd?.macd;

    const previousMacd = this.#previousMacd;

    if (macd === null || bands === null || atr === null || previousMacd === undefined) {
      return null;
    }

    return this.setResult(
      {
        deadZone: atr * this.deadZoneMultiplier,
        explosion: bands.upper - bands.lower,
        trend: (macd.macd - previousMacd) * this.sensitivity,
      },
      replace
    );
  }

  protected calculateSignalState(result?: WaddahAttarExplosionResult | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isExploding = hasResult && result.explosion > result.deadZone;
    const isBullish = isExploding && result.trend > 0;
    const isBearish = isExploding && result.trend < 0;

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
