import type {HighLowCloseVolume} from '../../base/Candle.type.js';
import {ZeroCrossSeries} from '../../base/Indicator.js';
import {SMA} from '../../trend/SMA/SMA.js';
import {getMedianPrice} from '../../util/getMedianPrice.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Ease of Movement (EMV)
 * Type: Volume
 *
 * The Ease of Movement (EMV) indicator relates the price change of a security to its volume and is particularly useful
 * for assessing the strength of a trend. A smoothed EMV above zero suggests prices are advancing with relative ease,
 * while below zero suggests prices are declining easily.
 *
 * Formula:
 * Distance Moved = ((High + Low) / 2) - ((Previous High + Previous Low) / 2)
 * Box Ratio = (Volume / scale) / (High - Low)
 * EMV(1) = Distance Moved / Box Ratio
 * EMV(n) = SMA(EMV(1), n)
 *
 * @see https://www.investopedia.com/terms/e/easeofmovement.asp
 */
export class EMV extends ZeroCrossSeries<HighLowCloseVolume> {
  readonly #candles: HighLowCloseVolume[] = [];
  readonly #sma: SMA;
  readonly #scale: number;

  public readonly interval: number;

  constructor(interval: number, scale: number = 100_000_000) {
    super();
    this.interval = interval;
    this.#sma = new SMA(interval);
    this.#scale = scale;
  }

  override getRequiredInputs() {
    return this.interval + 1;
  }

  update(candle: HighLowCloseVolume, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: 2, replace: replace});

    if (this.#candles.length < 2) {
      return null;
    }

    const prev = this.#candles[0];
    const distanceMoved = getMedianPrice(candle) - getMedianPrice(prev);
    const highLowDiff = candle.high - candle.low;

    let emv1 = 0;

    if (highLowDiff !== 0 && candle.volume !== 0) {
      const boxRatio = candle.volume / this.#scale / highLowDiff;
      emv1 = distanceMoved / boxRatio;
    }

    const smaResult = this.#sma.update(emv1, replace);

    if (smaResult === null) {
      return null;
    }

    return this.setResult(smaResult, replace);
  }
}
