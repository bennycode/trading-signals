import {TradingSignal, TrendIndicator} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';

export type PMOConfig = {
  /** Number of candles for the signal line's EMA over the PMO line (default: 10) */
  signalInterval?: number;
  /** Number of candles for the first, slower smoothing of the one-bar percentage change (default: 35) */
  smoothing1?: number;
  /** Number of candles for the second, faster smoothing whose output is the PMO line (default: 20) */
  smoothing2?: number;
};

export type PMOResult = {
  pmo: number;
  signal: number;
};

/**
 * DecisionPoint weights the newest bar with 2/interval — slightly heavier than a standard EMA's
 * 2/(interval + 1) — so the shared EMA building block cannot express the two PMO smoothing stages.
 */
class DecisionPointSmoothing {
  #inputCounter = 0;
  #current?: number;
  #previous?: number;
  readonly #interval: number;
  readonly #weightFactor: number;

  constructor(interval: number) {
    // The smoothing weight divides by the interval, so only a finite positive number keeps every reading finite
    if (!Number.isFinite(interval) || interval < 1) {
      throw new Error(`The interval has to be a positive number, but "${interval}" was given.`);
    }

    this.#interval = interval;
    this.#weightFactor = 2 / interval;
  }

  get isStable() {
    return this.#inputCounter >= this.#interval;
  }

  update(value: number, replace: boolean) {
    /*
     * The smoothing continues from the reading before the incoming value; replacing the value
     * that seeded it starts the seeding anew.
     */
    const previous = replace ? this.#previous : this.#current;

    if (!replace) {
      this.#inputCounter++;
      this.#previous = this.#current;
    }

    if (previous === undefined) {
      return (this.#current = value);
    }

    return (this.#current = value * this.#weightFactor + previous * (1 - this.#weightFactor));
  }
}

/**
 * DecisionPoint Price Momentum Oscillator (PMO)
 * Type: Momentum
 *
 * Carl Swenlin's PMO double-smooths the one-bar percentage price change with DecisionPoint's
 * custom smoothing and scales it by 10, so a market gaining a smoothed one percent per bar reads
 * as 10. Because it measures percentage change rather than price, readings stay comparable across
 * instruments and timeframes.
 *
 * Interpretation: The PMO crossing above its signal line (an EMA of the PMO) signals strengthening
 * momentum (bullish); crossing below signals weakening momentum (bearish). When both lines are
 * equal, momentum favors neither direction (sideways).
 *
 * All smoothing stages seed with their first input (this library's convention). Implementations
 * that seed with an SMA (e.g. Skender.Stock.Indicators) report different readings until the
 * seeding transient has decayed.
 *
 * @see https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/decisionpoint-price-momentum-oscillator-pmo
 */
export class PMO extends TrendIndicator<PMOResult, number> {
  #previousPrice?: number;
  #penultimatePrice?: number;

  readonly #rateOfChangeSmoothing: DecisionPointSmoothing;
  readonly #pmoSmoothing: DecisionPointSmoothing;
  readonly #signal: EMA;

  public readonly signalInterval: number;
  public readonly smoothing1: number;
  public readonly smoothing2: number;

  constructor({signalInterval = 10, smoothing1 = 35, smoothing2 = 20}: PMOConfig = {}) {
    super();
    this.signalInterval = signalInterval;
    this.smoothing1 = smoothing1;
    this.smoothing2 = smoothing2;
    this.#rateOfChangeSmoothing = new DecisionPointSmoothing(smoothing1);
    this.#pmoSmoothing = new DecisionPointSmoothing(smoothing2);
    this.#signal = new EMA(signalInterval);
  }

  override getRequiredInputs() {
    return this.smoothing1 + this.smoothing2;
  }

  update(price: number, replace: boolean) {
    // A replacement measures the percentage change against the price before the replaced candle
    const previousPrice = replace ? this.#penultimatePrice : this.#previousPrice;

    if (!replace) {
      this.#penultimatePrice = this.#previousPrice;
    }

    this.#previousPrice = price;

    if (previousPrice === undefined) {
      return null;
    }

    const rateOfChange = 100 * (price / previousPrice - 1);
    const smoothedRateOfChange = this.#rateOfChangeSmoothing.update(rateOfChange, replace);

    if (this.#rateOfChangeSmoothing.isStable) {
      // Scaling by 10 turns a smoothed one-percent-per-bar gain into a reading of 10
      const pmo = this.#pmoSmoothing.update(10 * smoothedRateOfChange, replace);

      if (this.#pmoSmoothing.isStable) {
        const signal = this.#signal.update(pmo, replace);

        return this.setResult(
          {
            pmo,
            signal,
          },
          replace
        );
      }
    }

    return null;
  }

  protected calculateSignalState(result?: PMOResult | null) {
    const hasResult = result !== null && result !== undefined;
    const isBullish = hasResult && result.pmo > result.signal;
    const isBearish = hasResult && result.pmo < result.signal;

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
