import {IndicatorInputShape, IndicatorSeries} from '../../base/Indicator.js';
import {SMA} from '../SMA/SMA.js';

/**
 * Wilder's Smoothed Moving Average (WSMA)
 * Type: Trend
 *
 * Developed by John Welles Wilder (Jr.) to help identifying and spotting bullish and bearish trends. Similar to
 * Exponential Moving Averages with the difference that a smoothing factor of 1/interval is being used, which makes it
 * respond more slowly to price changes.
 *
 * Synonyms:
 * - Modified Exponential Moving Average (MEMA)
 * - Smoothed Moving Average (SMMA)
 * - Welles Wilder's Smoothing (WWS)
 *
 * @see https://tlc.thinkorswim.com/center/reference/Tech-Indicators/studies-library/V-Z/WildersSmoothing
 */
export class WSMA extends IndicatorSeries {
  override readonly inputShape = IndicatorInputShape.VALUE;

  readonly #indicator: SMA;
  readonly #smoothingFactor: number;

  public readonly interval: number;

  constructor(interval: number) {
    super();
    this.interval = interval;
    this.#indicator = new SMA(interval);
    this.#smoothingFactor = 1 / this.interval;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    const sma = this.#indicator.update(price, replace);

    /*
     * The smoothing continues from the reading that existed before the incoming price. A replacement
     * of the price that completed the first window finds no such reading: that price produced the
     * seed, so the fresh average of the reshaped window re-seeds the smoothing.
     */
    const previous = replace ? this.previousResult : this.result;

    if (previous !== undefined) {
      const smoothed = (price - previous) * this.#smoothingFactor;
      return this.setResult(smoothed + previous, replace);
    }

    if (sma !== null) {
      return this.setResult(sma, replace);
    }

    return null;
  }
}
