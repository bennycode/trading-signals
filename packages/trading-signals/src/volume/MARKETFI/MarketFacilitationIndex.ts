import type {HighLowCloseVolume} from '../../base/Candle.type.js';
import {IndicatorInputShape, IndicatorSeries} from '../../base/Indicator.js';

/**
 * Market Facilitation Index (MARKETFI)
 * Type: Volume
 *
 * Bill Williams introduced this index in "Trading Chaos" as the "Market Facilitation Index" — traders abbreviate it
 * "BW MFI" because the plain "MFI" acronym already belongs to the unrelated Money Flow Index (see `MFI` in this
 * library). It divides a candle's trading range by its volume, telling a trader how much price movement a single
 * unit of volume was able to produce: a market that travels far on little volume facilitates trade easily, while a
 * market that absorbs heavy volume without moving is fighting over its current level. The close plays no role in
 * the formula; the shared candle type is reused instead of introducing a one-off high/low/volume shape.
 *
 * Interpretation: Williams never reads the value on its own — he pairs the index change with the volume change of
 * the same candle to classify it into his four windows: both rising ("green") confirms genuine participation, both
 * falling ("fade") marks a dying market, index up on falling volume ("fake") warns of a move without backing, and
 * index down on rising volume ("squat") flags a battle that often precedes a breakout. Because every reading only
 * gains meaning next to the volume bar, this indicator deliberately emits no standalone trading signal.
 *
 * @see https://en.wikipedia.org/wiki/Market_facilitation_index
 * @see https://tulipindicators.org/marketfi
 */
export class MarketFacilitationIndex extends IndicatorSeries<HighLowCloseVolume> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW_CLOSE_VOLUME;

  override getRequiredInputs() {
    return 1;
  }

  override update(candle: HighLowCloseVolume, replace: boolean) {
    /*
     * A candle nobody traded facilitates no price movement, so its reading is zero. This deliberately deviates
     * from the Tulip Indicators reference, which divides regardless and emits a non-finite value that no chart or
     * strategy can act on (same reasoning as the zero-range guard in KVO).
     */
    if (candle.volume === 0) {
      return this.setResult(0, replace);
    }

    return this.setResult((candle.high - candle.low) / candle.volume, replace);
  }
}
