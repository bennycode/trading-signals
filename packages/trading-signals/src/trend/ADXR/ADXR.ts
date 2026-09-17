import {ADX} from '../ADX/ADX.js';
import {IndicatorInputShape, IndicatorSeries} from '../../base/Indicator.js';
import type {HighLowClose} from '../../base/Candle.type.js';
import type {MovingAverageTypes} from '../MA/MovingAverageTypes.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';
import {WSMA} from '../WSMA/WSMA.js';

/**
 * Average Directional Movement Index Rating (ADXR)
 * Type: Trend (strength only)
 *
 * The ADXR was developed by John Welles Wilder (Jr.) as a companion to his ADX. It averages the
 * latest ADX with the ADX reading from one interval (minus one candle) earlier, which dampens the
 * spikes of the raw ADX. Wilder designed it as a rating to compare how trendy different markets
 * are: instruments with a high rating hold sustained trends and suit trend-following systems,
 * while instruments with a low rating drift without direction.
 *
 * Like the ADX itself, the rating measures only the strength of a trend, never its direction —
 * a strong downtrend and a strong uptrend produce the same reading, so no directional signal can
 * be derived from it.
 *
 * Interpretation:
 * The rating shares the ADX scale: readings below 20 indicate a weak or absent trend, and
 * readings above 40 indicate a strong trend. Because it blends in an older reading, the rating
 * reacts more slowly than the ADX — a divergence between the two shows whether trend strength is
 * currently building (ADX above its rating) or fading (ADX below its rating).
 *
 * @see https://tulipindicators.org/adxr
 * @see https://www.fmlabs.com/reference/ADXR.htm
 */
export class ADXR extends IndicatorSeries<HighLowClose<number>> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW_CLOSE;

  readonly #adx: ADX;
  readonly #adxHistory: number[] = [];

  public readonly interval: number;

  constructor(interval: number = 14, SmoothingIndicator: MovingAverageTypes = WSMA) {
    super();
    this.interval = interval;
    this.#adx = new ADX(interval, SmoothingIndicator);
  }

  override getRequiredInputs() {
    return this.interval * 3 - 2;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const adx = this.#adx.update(candle, replace);

    if (adx === null) {
      return null;
    }

    pushUpdate({
      array: this.#adxHistory,
      item: adx,
      maxLength: this.interval,
      replace,
    });

    if (this.#adxHistory.length === this.interval) {
      const laggedAdx = this.#adxHistory[0];

      return this.setResult((adx + laggedAdx) / 2, replace);
    }

    return null;
  }
}
