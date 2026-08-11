import {IndicatorSeries} from '../../base/Indicator.js';
import {getMaximum} from '../../util/getMaximum.js';
import {getMinimum} from '../../util/getMinimum.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Vertical Horizontal Filter (VHF)
 * Type: Trend
 *
 * Created by the trader Adam White (Futures magazine, 1991), the Vertical Horizontal Filter tells a
 * trending market from a congesting one by relating the widest span between closing prices (the
 * vertical component) to the ground those closes actually covered on the way (the horizontal
 * component). A trend walks its span nearly in a straight line, so span and path almost coincide
 * and the reading approaches 1. A congesting market crosses the same prices again and again, so the
 * path dwarfs the span and the reading approaches 0.
 *
 * Interpretation:
 * There is no fixed banding — the reading is compared against its own recent history: rising values
 * mark a strengthening trend (favor trend-following tools), falling values mark developing
 * congestion (favor oscillators). The reading is direction-agnostic — a crash and a rally both read
 * as trending — which is why this indicator emits no trading signal; direction has to come from a
 * trend-following companion.
 *
 * @see https://tulipindicators.org/vhf
 * @see https://www.incrediblecharts.com/indicators/vertical_horizontal_filter.php
 */
export class VHF extends IndicatorSeries {
  readonly #closes: number[] = [];
  readonly #changes: number[] = [];
  #previousClose?: number;
  #twoPreviousClose?: number;

  public readonly interval: number;

  constructor(interval: number = 28) {
    super();

    // Without a single close in the window there is neither a span nor a path to relate
    if (interval < 1) {
      throw new Error(`The interval has to be at least 1, but "${interval}" was given.`);
    }

    this.interval = interval;
  }

  override getRequiredInputs() {
    // The close ahead of the window only contributes the move that carries price into the window
    return this.interval + 1;
  }

  update(close: number, replace: boolean) {
    if (replace) {
      this.#previousClose = this.#twoPreviousClose;
    }

    if (this.#previousClose === undefined) {
      this.#previousClose = close;
      return null;
    }

    const change = Math.abs(close - this.#previousClose);

    this.#twoPreviousClose = this.#previousClose;
    this.#previousClose = close;

    // The span reads off the closes inside the window, while the path also counts the move that carried price into it
    pushUpdate({array: this.#closes, item: close, maxLength: this.interval, replace});
    pushUpdate({array: this.#changes, item: change, maxLength: this.interval, replace});

    if (this.#changes.length < this.interval) {
      return null;
    }

    let path = 0;

    for (const move of this.#changes) {
      path += move;
    }

    /*
     * A dead-flat stretch is the one degenerate case: price that never moved has neither a span nor
     * a path, and relating nothing to nothing yields no number at all. No movement also means there
     * is no trend to measure, so the reading is pinned at 0 — the congested end of the scale.
     */
    if (path === 0) {
      return this.setResult(0, replace);
    }

    return this.setResult((getMaximum(this.#closes) - getMinimum(this.#closes)) / path, replace);
  }
}
