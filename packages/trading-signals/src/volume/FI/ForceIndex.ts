import type {HighLowCloseVolume} from '../../base/Candle.type.js';
import {ZeroCrossSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Force Index (FI)
 * Type: Volume
 *
 * Dr. Alexander Elder's Force Index measures the power behind a price move by combining its three
 * ingredients: the direction of the price change, its extent, and the volume that fueled it. The
 * raw force of a single candle is erratic, so Elder smooths the series with an EMA (13 periods by
 * default) to expose the sustained pressure of buyers or sellers.
 *
 * Formula:
 * Force = (Close - Previous Close) * Volume
 * FI = EMA(Force, n)
 *
 * Interpretation: A Force Index above zero means buyers are in control (bullish pressure), below
 * zero sellers are in control (bearish pressure). Crossings of the zero line mark a shift of
 * control between the two sides.
 *
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:force_index
 * @see Alexander Elder, "Trading for a Living" (1993), where the indicator was introduced
 */
export class ForceIndex extends ZeroCrossSeries<HighLowCloseVolume> {
  readonly #candles: HighLowCloseVolume[] = [];
  readonly #ema: EMA;

  public readonly interval: number;

  constructor(interval: number = 13) {
    super();
    this.interval = interval;
    this.#ema = new EMA(interval);
  }

  override getRequiredInputs() {
    return this.#ema.getRequiredInputs() + 1;
  }

  update(candle: HighLowCloseVolume, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: 2, replace});

    if (this.#candles.length < 2) {
      return null;
    }

    const previousClose = this.#candles[0].close;
    const force = (candle.close - previousClose) * candle.volume;
    const smoothed = this.#ema.update(force, replace);

    if (this.#ema.isStable) {
      return this.setResult(smoothed, replace);
    }

    return null;
  }
}
