import {MovingAverage} from '../MA/MovingAverage.js';
import {NotEnoughDataError} from '../../error/index.js';

type FilterState = {
  previousFilter: number;
  previousPrice: number;
  secondPreviousFilter: number | undefined;
};

/**
 * SuperSmoother Filter (SSF)
 * Type: Trend
 *
 * John Ehlers designed the SuperSmoother as a replacement for moving-average smoothing: a 2-pole
 * Butterworth low-pass filter fed with the average of the two most recent prices. Wave components
 * shorter than the configured interval count as aliasing noise and are rejected almost completely,
 * and the 2-bar price average cancels the shortest wave sampled data can carry before it even
 * reaches the filter. The payoff over an SMA or EMA of comparable smoothness is considerably less
 * lag, which is why Ehlers uses the SuperSmoother as the standard smoothing block inside his other
 * indicators.
 *
 * The filter warm-starts on raw prices, following the convention of Ehlers' published code
 * ("if currentbar < 3 then Filt = Close"): the first two readings equal the price itself, and the
 * recursion takes over on the third bar, once two prior readings exist. Ehlers' listings use the
 * rounded constants 1.414 and 3.14159; this implementation uses the square root of 2 and pi at
 * full precision.
 *
 * @see https://www.mesasoftware.com/papers/PredictiveIndicators.pdf
 * @see John F. Ehlers: "Cycle Analytics for Traders" (2013), Chapter 3
 */
export class SuperSmoother extends MovingAverage {
  #pricesCounter = 0;
  readonly #c1: number;
  readonly #c2: number;
  readonly #c3: number;
  #state?: FilterState;
  #previousState?: FilterState;

  constructor(interval: number) {
    super(interval);
    const angle = (Math.SQRT2 * Math.PI) / interval;
    const a1 = Math.exp(-angle);
    this.#c2 = 2 * a1 * Math.cos(angle);
    this.#c3 = -a1 * a1;
    this.#c1 = 1 - this.#c2 - this.#c3;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    if (!replace || this.#pricesCounter === 0) {
      this.#pricesCounter++;
    }

    /*
     * The recursion feeds on the price and the two filter readings that existed before the
     * incoming price, so a replacement has to continue from the state before the replaced
     * price instead of the state it produced.
     */
    if (replace) {
      this.#state = this.#previousState;
    } else {
      this.#previousState = this.#state;
    }

    const state = this.#state;

    let filter: number;

    if (state === undefined || state.secondPreviousFilter === undefined) {
      // Ehlers warm-starts on raw prices until two prior filter readings exist
      filter = price;
    } else {
      filter =
        this.#c1 * ((price + state.previousPrice) / 2) +
        this.#c2 * state.previousFilter +
        this.#c3 * state.secondPreviousFilter;
    }

    this.#state = {
      previousFilter: filter,
      previousPrice: price,
      secondPreviousFilter: state?.previousFilter,
    };

    return this.setResult(filter, replace);
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
