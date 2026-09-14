import {IndicatorInputShape, TradingSignal, TrendIndicator} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {RSI} from '../RSI/RSI.js';

export type QQEConfig = {
  /**
   * How many units of the smoothed RSI's own volatility the trailing stop lags behind it
   * (default: 4.236, the Fibonacci-derived "fast" factor of the original)
   */
  fastFactor?: number;
  /** Number of candles for the underlying Wilder-smoothed RSI (default: 14) */
  rsiInterval?: number;
  /** Number of readings for the smoothing that turns the raw RSI into the RSI MA line (default: 5) */
  smoothInterval?: number;
};

export type QQEResult = {
  /** Smoothed RSI line the indicator is built around; the side it takes of the trailing stop names the momentum direction */
  rsiMa: number;
  /** Volatility-based stop the smoothed RSI trails against: support below it in bullish phases, resistance above it in bearish phases */
  trailingStop: number;
};

type QQEBands = {
  isUp: boolean;
  longband: number;
  shortband: number;
};

type QQEState = {
  bands?: QQEBands;
  previousBands?: QQEBands;
  rsiMa?: number;
};

/**
 * Quantitative Qualitative Estimation (QQE)
 * Type: Momentum
 *
 * Roman Ignatov published the QQE for MetaTrader 4 as an RSI a trend follower can hold on to: the
 * raw RSI is smoothed into a calmer "RSI MA" line, and that line's own volatility — its absolute
 * change, Wilder-smoothed twice — is scaled by a factor and trailed behind it as a stop line. It
 * is the SuperTrend construction applied to the RSI instead of price: the stop ratchets toward
 * the smoothed RSI while a move lasts and switches sides once the line breaks through it.
 *
 * Interpretation:
 * Momentum is BULLISH while the smoothed RSI rides above its trailing stop and BEARISH while the
 * stop caps it from above, so a flip of the stop line marks a momentum reversal without relying
 * on fixed overbought/oversold levels. Like every trend-following overlay it whipsaws when the
 * market goes quiet and dies down.
 *
 * Every smoothing stage seeds with its first input and starts only once the stage before it is
 * stable (this library's convention, shared with DOSC, TEMA and T3), so early readings differ
 * slightly from platforms that seed their smoothing differently.
 *
 * @see https://www.tradingview.com/script/0vn4HZ7O-Quantitative-Qualitative-Estimation-QQE/
 * @see https://www.tradingview.com/script/34U0KMEK-QQE-MT4-Glaz-modified-by-JustUncleL/
 */
export class QQE extends TrendIndicator<QQEResult, number, QQEState> {
  override readonly inputShape = IndicatorInputShape.VALUE;

  readonly #rsi: RSI;
  readonly #rsiSmoothing: EMA;
  readonly #firstVolatilitySmoothing: EMA;
  readonly #secondVolatilitySmoothing: EMA;
  /**
   * An EMA over "2n - 1" readings weights new data exactly like Wilder's smoothing over "n"
   * readings, which is how the original formulates its two volatility stages.
   */
  readonly #wilderInterval: number;

  public readonly fastFactor: number;
  public readonly rsiInterval: number;
  public readonly smoothInterval: number;

  constructor({fastFactor = 4.236, rsiInterval = 14, smoothInterval = 5}: QQEConfig = {}) {
    super();
    this.fastFactor = fastFactor;
    this.rsiInterval = rsiInterval;
    this.smoothInterval = smoothInterval;
    this.#wilderInterval = 2 * rsiInterval - 1;
    this.#rsi = new RSI(rsiInterval);
    this.#rsiSmoothing = new EMA(smoothInterval);
    this.#firstVolatilitySmoothing = new EMA(this.#wilderInterval);
    this.#secondVolatilitySmoothing = new EMA(this.#wilderInterval);
  }

  override getRequiredInputs() {
    /*
     * The first candle only anchors the RSI's first gain/loss reading, the volatility measurement
     * consumes one further reading for the first change of the smoothed RSI, and every smoothing
     * stage begins with the first stable reading of the stage before it.
     */
    return this.rsiInterval + this.smoothInterval + 2 * this.#wilderInterval - 1;
  }

  update(price: number, replace: boolean) {
    this.trackState(replace);

    const rsi = this.#rsi.update(price, replace);

    if (rsi === null) {
      return null;
    }

    const rsiMa = this.#rsiSmoothing.update(rsi, replace);

    if (!this.#rsiSmoothing.isStable) {
      return null;
    }

    const previousRsiMa = this.state.rsiMa;
    this.state.rsiMa = rsiMa;

    if (previousRsiMa === undefined) {
      return null;
    }

    const volatility = Math.abs(rsiMa - previousRsiMa);
    const onceSmoothed = this.#firstVolatilitySmoothing.update(volatility, replace);

    if (!this.#firstVolatilitySmoothing.isStable) {
      return null;
    }

    const twiceSmoothed = this.#secondVolatilitySmoothing.update(onceSmoothed, replace);

    if (!this.#secondVolatilitySmoothing.isStable) {
      return null;
    }

    const bandOffset = twiceSmoothed * this.fastFactor;
    const newLongband = rsiMa - bandOffset;
    const newShortband = rsiMa + bandOffset;

    const previousBands = this.state.bands;
    const penultimateBands = this.state.previousBands;

    let bands: QQEBands;

    if (previousBands === undefined) {
      // The very first pair of bands has no history to trail against, and the reference formulation starts long
      bands = {isUp: true, longband: newLongband, shortband: newShortband};
    } else {
      // Each band only ratchets toward the smoothed RSI while the line stays on its side; any break resets it
      const longband =
        previousRsiMa > previousBands.longband && rsiMa > previousBands.longband
          ? Math.max(previousBands.longband, newLongband)
          : newLongband;
      const shortband =
        previousRsiMa < previousBands.shortband && rsiMa < previousBands.shortband
          ? Math.min(previousBands.shortband, newShortband)
          : newShortband;

      /*
       * The trend flips when the smoothed RSI crosses the band of the bar before, which compares
       * the current reading against the band values of the two preceding bars. A cross of the
       * upper band flips long before a cross of the lower band is considered, matching the
       * precedence of the reference formulation.
       */
      const hasCrossedShortband =
        penultimateBands !== undefined &&
        ((rsiMa > previousBands.shortband && previousRsiMa <= penultimateBands.shortband) ||
          (rsiMa < previousBands.shortband && previousRsiMa >= penultimateBands.shortband));
      const hasCrossedLongband =
        penultimateBands !== undefined &&
        ((rsiMa > previousBands.longband && previousRsiMa <= penultimateBands.longband) ||
          (rsiMa < previousBands.longband && previousRsiMa >= penultimateBands.longband));

      const isUp = hasCrossedShortband ? true : hasCrossedLongband ? false : previousBands.isUp;

      bands = {isUp, longband, shortband};
    }

    this.state.previousBands = previousBands;
    this.state.bands = bands;

    return this.setResult(
      {
        rsiMa,
        trailingStop: bands.isUp ? bands.longband : bands.shortband,
      },
      replace
    );
  }

  protected calculateSignalState(result?: QQEResult | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isBullish = hasResult && result.rsiMa > result.trailingStop;
    const isBearish = hasResult && result.rsiMa < result.trailingStop;

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
