import type {HighLow} from '../../types/Candle.types.js';
import {TechnicalIndicator} from '../../types/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

export interface AroonResult {
  /** Measures how recently the lowest low occurred (100 = this candle, 0 = interval candles ago) */
  aroonDown: number;
  /** Measures how recently the highest high occurred (100 = this candle, 0 = interval candles ago) */
  aroonUp: number;
}

/**
 * Aroon (AROON)
 * Type: Trend
 *
 * The Aroon indicator was developed by Tushar Chande and identifies emerging trends by measuring the time between
 * highs and lows: prices regularly hitting new highs signal an uptrend, prices regularly hitting new lows signal a
 * downtrend. Both lines oscillate between 0 and 100. An Aroon Up above 70 with an Aroon Down below 30 indicates a
 * strong uptrend (and vice versa for a downtrend). Crossovers of the two lines can signal trend changes.
 *
 * @see https://www.investopedia.com/terms/a/aroon.asp
 * @see https://tulipindicators.org/aroon
 */
export class Aroon extends TechnicalIndicator<AroonResult, HighLow<number>> {
  readonly #candles: HighLow<number>[] = [];
  public readonly interval: number;

  constructor(interval: number) {
    super();
    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval + 1;
  }

  update(candle: HighLow<number>, replace: boolean) {
    pushUpdate(this.#candles, replace, candle, this.getRequiredInputs());

    if (this.#candles.length < this.getRequiredInputs()) {
      return null;
    }

    // When the extreme occurs multiple times, the most recent occurrence wins (matches Tulip Indicators)
    let highestIndex = 0;
    let lowestIndex = 0;

    this.#candles.forEach(({high, low}, i) => {
      if (high >= this.#candles[highestIndex].high) {
        highestIndex = i;
      }

      if (low <= this.#candles[lowestIndex].low) {
        lowestIndex = i;
      }
    });

    const newestIndex = this.#candles.length - 1;
    const aroonDown = (100 * (this.interval - (newestIndex - lowestIndex))) / this.interval;
    const aroonUp = (100 * (this.interval - (newestIndex - highestIndex))) / this.interval;

    return (this.result = {aroonDown, aroonUp});
  }
}
