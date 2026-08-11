import {MovingAverage} from '../MA/MovingAverage.js';
import {NotEnoughDataError} from '../../error/index.js';

/**
 * McGinley's published smoothing constant. It speeds the average up so an N-period Dynamic tracks
 * price about as closely as an N-period EMA; sources that quote the formula without the constant
 * describe a noticeably slower line for the same interval.
 */
const SMOOTHING_CONSTANT = 0.6;

/**
 * McGinley Dynamic (MD)
 * Type: Trend
 *
 * Developed by John R. McGinley, a market technician of the Market Technicians Association, and
 * published in its Journal of Technical Analysis in the 1990s. Where a fixed-period average always
 * reacts at the same speed, the Dynamic adjusts its own smoothing to the speed of the market: it
 * accelerates in falling markets to track sell-offs closely and decelerates in rising markets, so
 * it hugs prices without the whipsaws and price separation that fixed-period averages suffer.
 *
 * Seeding of the recursion matches Skender.Stock.Indicators: the first price seeds the average.
 *
 * @see https://www.investopedia.com/terms/m/mcginley-dynamic.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:mcginley_dynamic
 */
export class McGinleyDynamic extends MovingAverage {
  #pricesCounter = 0;

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    if (!replace || this.#pricesCounter === 0) {
      this.#pricesCounter++;
    }

    /*
     * The recursion continues from the reading that existed before the incoming price. A
     * replacement of the very first price finds no such reading: that price seeded the average,
     * so the average has to be seeded anew instead of continuing from the seed it replaces.
     */
    const previous = replace ? this.previousResult : this.result;

    if (previous === undefined) {
      return this.setResult(price, replace);
    }

    /*
     * The tracking speed rests on the ratio of price to average, which degenerates once either
     * side sits at zero: the formula would produce an infinite or undefined reading. A zero level
     * instead pins the average at zero — an average of a worthless instrument is worthless, and it
     * only recovers through a fresh seed, not through the recursion.
     */
    if (previous === 0 || price === 0) {
      return this.setResult(0, replace);
    }

    const trackingSpeed = SMOOTHING_CONSTANT * this.interval * (price / previous) ** 4;

    return this.setResult(previous + (price - previous) / trackingSpeed, replace);
  }

  override getResultOrThrow() {
    if (this.#pricesCounter < this.interval) {
      throw new NotEnoughDataError(this.getRequiredInputs());
    }

    return this.result!;
  }

  override get isStable() {
    try {
      this.getResultOrThrow();
      return true;
    } catch {
      return false;
    }
  }
}
