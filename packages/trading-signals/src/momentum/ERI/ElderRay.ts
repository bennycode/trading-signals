import {EMA} from '../../trend/EMA/EMA.js';
import type {HighLowClose} from '../../base/Candle.type.js';
import {IndicatorInputShape, TradingSignal, TrendIndicator} from '../../base/Indicator.js';

export type ElderRayResult = {
  /** Sellers' ability to drag the price below the consensus of value (negative readings show seller strength) */
  bearPower: number;
  /** Buyers' ability to lift the price above the consensus of value (positive readings show buyer strength) */
  bullPower: number;
};

/**
 * Elder Ray Index (ERI)
 * Type: Momentum
 *
 * The Elder Ray Index was developed by Dr. Alexander Elder and introduced in his book "Trading for a Living" (1993).
 * It treats an Exponential Moving Average (EMA) of closing prices (13 periods by default) as the market's consensus of
 * value and measures how far the bulls and bears manage to push the price away from it: Bull Power is the distance of
 * the candle's high above the consensus, Bear Power the distance of the candle's low below it.
 *
 * Interpretation: When both powers are positive, even the low of the candle trades above the consensus of value, so
 * buyers dominate the whole bar (bullish pressure). When both powers are negative, even the high stays below the
 * consensus, so sellers dominate (bearish pressure). A bar straddling the consensus shows neither side in control.
 *
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:elder_ray_index
 * @see https://www.investopedia.com/articles/trading/03/022603.asp
 */
export class ElderRay extends TrendIndicator<ElderRayResult, HighLowClose<number>> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW_CLOSE;

  readonly #ema: EMA;
  public readonly interval: number;

  constructor(interval: number = 13) {
    super();
    this.interval = interval;
    this.#ema = new EMA(interval);
  }

  override getRequiredInputs() {
    return this.#ema.getRequiredInputs();
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    this.#ema.update(candle.close, replace);

    if (!this.#ema.isStable) {
      return null;
    }

    const ema = this.#ema.getResultOrThrow();

    return this.setResult(
      {
        bearPower: candle.low - ema,
        bullPower: candle.high - ema,
      },
      replace
    );
  }

  protected calculateSignalState(result?: ElderRayResult | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isBullish = hasResult && result.bullPower > 0 && result.bearPower > 0;
    const isBearish = hasResult && result.bullPower < 0 && result.bearPower < 0;

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
