import type {HighLowCloseVolume} from '../../base/Candle.type.js';
import {IndicatorInputShape, ZeroCrossSeries} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

/**
 * Chaikin Money Flow (CMF)
 * Type: Volume
 *
 * The Chaikin Money Flow (CMF) measures the amount of money flow volume over a specific period. It oscillates between
 * -1 and +1. A CMF above zero indicates buying pressure (accumulation), while a CMF below zero indicates selling
 * pressure (distribution).
 *
 * Formula:
 * Money Flow Multiplier = ((Close - Low) - (High - Close)) / (High - Low)
 * Money Flow Volume = Money Flow Multiplier * Volume
 * CMF = Sum(Money Flow Volume, n) / Sum(Volume, n)
 *
 * @see https://www.investopedia.com/terms/c/chaikinoscillator.asp
 */
export class CMF extends ZeroCrossSeries<HighLowCloseVolume> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW_CLOSE_VOLUME;

  readonly #candles: HighLowCloseVolume[] = [];

  public readonly interval: number;

  constructor(interval: number) {
    super();
    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(candle: HighLowCloseVolume, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.interval, replace: replace});

    if (this.#candles.length < this.interval) {
      return null;
    }

    let sumMoneyFlowVolume = 0;
    let sumVolume = 0;

    for (const c of this.#candles) {
      const highLowDiff = c.high - c.low;
      let moneyFlowMultiplier = 0;

      if (highLowDiff !== 0) {
        moneyFlowMultiplier = (c.close - c.low - (c.high - c.close)) / highLowDiff;
      }

      sumMoneyFlowVolume += moneyFlowMultiplier * c.volume;
      sumVolume += c.volume;
    }

    const cmf = sumVolume === 0 ? 0 : sumMoneyFlowVolume / sumVolume;

    return this.setResult(cmf, replace);
  }
}
