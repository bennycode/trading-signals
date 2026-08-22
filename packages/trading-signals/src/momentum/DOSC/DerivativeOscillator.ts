import {IndicatorInputShape, ZeroCrossSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {SMA} from '../../trend/SMA/SMA.js';
import {RSI} from '../RSI/RSI.js';

export type DerivativeOscillatorConfig = {
  /** Number of readings for the first smoothing of the RSI (default: 5) */
  ema1Interval?: number;
  /** Number of readings for the second smoothing of the RSI (default: 3) */
  ema2Interval?: number;
  /** Number of candles for the underlying Wilder-smoothed RSI (default: 14) */
  rsiInterval?: number;
  /** Number of readings for the signal line subtracted from the double smoothed RSI (default: 9) */
  smaInterval?: number;
};

/**
 * Derivative Oscillator (DOSC)
 * Type: Momentum
 *
 * Constance Brown introduced the Derivative Oscillator as an evolution of her double smoothed
 * RSI: the RSI is run through two consecutive EMAs, and the histogram plots how far that double
 * smoothed RSI has pulled away from its own simple moving average — the construction MACD applies
 * to price, applied to the RSI instead. The double smoothing strips out RSI noise, so the
 * histogram highlights momentum shifts that survive the filtering.
 *
 * Interpretation:
 * A histogram above the zero line signals bullish momentum, below it bearish momentum, and the
 * zero-line crossings mark the shifts between the two. A divergence between histogram extremes
 * and price extremes warns that the move is running out of force.
 *
 * Every smoothing stage seeds with its first input and starts only once the stage before it is
 * stable (this library's convention, shared with TEMA and T3), so early readings differ slightly
 * from platforms that seed their smoothing differently.
 *
 * @see Constance Brown, "Technical Analysis for the Trading Professional" (McGraw-Hill, 1999)
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/derivative-oscillator
 * @see https://www.tradingview.com/support/solutions/43000502248-derivative-oscillator/
 */
export class DerivativeOscillator extends ZeroCrossSeries {
  override readonly inputShape = IndicatorInputShape.VALUE;

  readonly #rsi: RSI;
  readonly #firstSmoothing: EMA;
  readonly #secondSmoothing: EMA;
  readonly #signalLine: SMA;

  public readonly ema1Interval: number;
  public readonly ema2Interval: number;
  public readonly rsiInterval: number;
  public readonly smaInterval: number;

  constructor({
    ema1Interval = 5,
    ema2Interval = 3,
    rsiInterval = 14,
    smaInterval = 9,
  }: DerivativeOscillatorConfig = {}) {
    super();
    this.ema1Interval = ema1Interval;
    this.ema2Interval = ema2Interval;
    this.rsiInterval = rsiInterval;
    this.smaInterval = smaInterval;
    this.#rsi = new RSI(rsiInterval);
    this.#firstSmoothing = new EMA(ema1Interval);
    this.#secondSmoothing = new EMA(ema2Interval);
    this.#signalLine = new SMA(smaInterval);
  }

  override getRequiredInputs() {
    /*
     * The first candle only anchors the RSI's first gain/loss reading, and every smoothing stage
     * begins with the first stable reading of the stage before it.
     */
    return this.rsiInterval + this.ema1Interval + this.ema2Interval + this.smaInterval - 2;
  }

  update(price: number, replace: boolean) {
    const rsi = this.#rsi.update(price, replace);

    if (rsi === null) {
      return null;
    }

    const onceSmoothed = this.#firstSmoothing.update(rsi, replace);

    if (!this.#firstSmoothing.isStable) {
      return null;
    }

    const smoothedRsi = this.#secondSmoothing.update(onceSmoothed, replace);

    if (!this.#secondSmoothing.isStable) {
      return null;
    }

    const signalLine = this.#signalLine.update(smoothedRsi, replace);

    if (signalLine === null) {
      return null;
    }

    return this.setResult(smoothedRsi - signalLine, replace);
  }
}
