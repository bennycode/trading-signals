import {TradingSignal, TrendIndicatorSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';

/**
 * Triple Smoothed EMA Rate of Change (TRIX)
 * Type: Momentum
 *
 * TRIX was developed by Jack Hutson and reports the percent change of a triple smoothed EMA from one candle to the
 * next. The triple smoothing filters out moves shorter than the interval, so TRIX only reacts to changes it
 * considers significant — its zero-line crossings are used as trend-change signals with less whipsaw than raw
 * momentum oscillators.
 *
 * The percent change divides by the previous triple EMA (the textbook definition, as used by TA-Lib and most
 * charting platforms). Note: Tulip Indicators divides by the current value instead, so its reference values differ
 * slightly.
 *
 * @see https://www.investopedia.com/terms/t/trix.asp
 * @see https://tulipindicators.org/trix
 */
export class TRIX extends TrendIndicatorSeries {
  readonly #single: EMA;
  readonly #double: EMA;
  readonly #triple: EMA;
  #previousTripleEma?: number;
  #penultimateTripleEma?: number;

  public readonly interval: number;

  constructor(interval: number) {
    super();
    this.interval = interval;
    this.#single = new EMA(interval);
    this.#double = new EMA(interval);
    this.#triple = new EMA(interval);
  }

  override getRequiredInputs() {
    return 3 * (this.interval - 1) + 2;
  }

  update(price: number, replace: boolean) {
    const single = this.#single.update(price, replace);

    if (this.#single.isStable) {
      const double = this.#double.update(single, replace);

      if (this.#double.isStable) {
        const triple = this.#triple.update(double, replace);

        if (this.#triple.isStable) {
          const previous = replace ? this.#penultimateTripleEma : this.#previousTripleEma;

          if (!replace) {
            this.#penultimateTripleEma = this.#previousTripleEma;
          }

          this.#previousTripleEma = triple;

          if (previous !== undefined && previous !== 0) {
            return this.setResult((100 * (triple - previous)) / previous, replace);
          }
        }
      }
    }

    return null;
  }

  protected calculateSignalState(result: number | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isBullish = hasResult && result > 0;
    const isBearish = hasResult && result < 0;

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
