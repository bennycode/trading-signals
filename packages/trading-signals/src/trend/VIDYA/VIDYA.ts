import {CMO} from '../../momentum/CMO/CMO.js';
import {MovingAverage} from '../MA/MovingAverage.js';

/**
 * Variable Index Dynamic Average (VIDYA)
 * Type: Trend
 *
 * VIDYA was developed by Tushar Chande. It behaves like an EMA whose speed is not fixed: the smoothing weight is
 * scaled by the absolute Chande Momentum Oscillator over the same interval, so the average hugs price in strong
 * trends and flattens into a noise filter when the market chops sideways.
 *
 * Chande published two variants. His original from 1992 derives its volatility index from a ratio of standard
 * deviations — that is the variant Tulip Indicators implements. This class implements the later CMO-based
 * definition from Chande & Kroll's book "The New Technical Trader" (1994), which TradingView, MetaTrader and most
 * modern libraries use. Results of the two variants are not comparable.
 *
 * Seeding: the recursion starts from the very first price, so once the internal momentum window has filled up, the
 * first result blends the current price with that seed. Libraries disagree on this choice (pandas-ta seeds with
 * zero), which makes early values differ between implementations even when the formula matches.
 *
 * @see https://www.metatrader5.com/en/terminal/help/indicators/trend_indicators/vida
 * @see https://tulipindicators.org/vidya
 */
export class VIDYA extends MovingAverage {
  readonly #cmo: CMO;
  readonly #weightFactor: number;
  #pricesCounter = 0;
  #seedPrice?: number;

  constructor(interval: number) {
    super(interval);
    this.#cmo = new CMO(interval);
    this.#weightFactor = 2 / (interval + 1);
  }

  override getRequiredInputs() {
    return this.#cmo.getRequiredInputs();
  }

  update(price: number, replace: boolean) {
    if (!replace) {
      this.#pricesCounter++;
    } else if (this.#pricesCounter === 0) {
      // A replacement before any input counts as the first input
      this.#pricesCounter++;
    }

    // Only the very first price defines the seed, so replacing that price re-seeds the recursion
    if (this.#pricesCounter === 1) {
      this.#seedPrice = price;
    }

    const cmo = this.#cmo.update(price, replace);

    if (cmo === null) {
      return null;
    }

    const smoothing = this.#weightFactor * (Math.abs(cmo) / 100);
    // The fallback is guaranteed to exist: the seed was captured with the very first price, long before the momentum window fills up
    const previous = ((replace ? this.previousResult : this.result) ?? this.#seedPrice) as number;

    return this.setResult(smoothing * price + (1 - smoothing) * previous, replace);
  }
}
