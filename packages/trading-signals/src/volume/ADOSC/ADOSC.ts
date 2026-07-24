import type {HighLowCloseVolume} from '../../base/Candle.type.js';
import {TradingSignal, TrendIndicatorSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {AD} from '../AD/AD.js';

export type ADOSCConfig = {
  /** Number of candles for the fast EMA of the A/D line (default: 3) */
  fastPeriod?: number;
  /** Number of candles for the slow EMA of the A/D line (default: 10) */
  slowPeriod?: number;
};

/**
 * Chaikin Oscillator (ADOSC)
 * Type: Volume
 *
 * Marc Chaikin's oscillator applies the MACD principle to the Accumulation/Distribution line instead of price: the
 * spread between a fast and slow EMA of the A/D line measures the momentum of money flowing into or out of a
 * security. Because it is driven by volume-weighted buying pressure rather than price, it can diverge from price and
 * flag accumulation or distribution before the chart shows it.
 *
 * @see https://www.investopedia.com/terms/c/chaikinoscillator.asp
 * @see https://tulipindicators.org/adosc
 */
export class ADOSC extends TrendIndicatorSeries<HighLowCloseVolume> {
  readonly #ad = new AD();
  readonly #fast: EMA;
  readonly #slow: EMA;

  public readonly fastPeriod: number;
  public readonly slowPeriod: number;

  constructor({fastPeriod = 3, slowPeriod = 10}: ADOSCConfig = {}) {
    super();
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.#fast = new EMA(fastPeriod);
    this.#slow = new EMA(slowPeriod);
  }

  override getRequiredInputs() {
    return this.#slow.getRequiredInputs();
  }

  update(candle: HighLowCloseVolume, replace: boolean) {
    const ad = this.#ad.update(candle, replace);
    const fast = this.#fast.update(ad, replace);
    const slow = this.#slow.update(ad, replace);

    if (this.#slow.isStable) {
      return this.setResult(fast - slow, replace);
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
