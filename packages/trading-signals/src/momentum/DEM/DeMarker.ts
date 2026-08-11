import type {HighLow} from '../../base/Candle.type.js';
import {ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

export type DeMarkerConfig = {
  /** Number of candle-to-candle comparisons that are averaged */
  interval?: number;
  signalThresholds?: SignalThresholds;
};

/**
 * DeMarker (DeM)
 * Type: Momentum
 *
 * Developed by Thomas DeMark, the DeMarker weighs how far each candle pushes above the previous high
 * (DeMax) against how far it dips below the previous low (DeMin). Averaging both series over the interval
 * and taking the buying share of the total yields an oscillator between 0 and 1: readings near 1 mean the
 * market keeps printing higher highs, readings near 0 mean it keeps printing lower lows. Because it reads
 * intra-bar extremes instead of closes, it registers directional pressure even when closes barely move.
 *
 * Interpretation:
 * A reading of 0.7 or above indicates an overbought market and 0.3 or below an oversold market (both
 * thresholds can be customized via the constructor). A dead market that prints neither higher highs nor
 * lower lows offers no directional pressure to weigh, so the oscillator reads neutral (0.5).
 *
 * @see https://www.metatrader5.com/en/terminal/help/indicators/oscillators/demarker
 * @see https://www.investopedia.com/terms/d/demarkerindicator.asp
 */
export class DeMarker extends ThresholdCrossSeries<HighLow<number>> {
  readonly #candles: HighLow<number>[] = [];
  public readonly interval: number;

  constructor({interval = 14, signalThresholds: {overbought = 0.7, oversold = 0.3} = {}}: DeMarkerConfig = {}) {
    super({overbought, oversold});
    this.interval = interval;
  }

  override getRequiredInputs() {
    // The first candle only seeds the comparison, so one extra candle precedes the averaged window
    return this.interval + 1;
  }

  update(candle: HighLow<number>, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.interval + 1, replace});

    if (this.#candles.length < this.getRequiredInputs()) {
      return null;
    }

    let deMaxSum = 0;
    let deMinSum = 0;

    /*
     * The published formula averages DeMax and DeMin with a simple moving average over the same period
     * before taking the ratio; the shared divisor cancels out, so plain sums yield the identical reading.
     */
    for (let i = 1; i < this.#candles.length; i++) {
      const current = this.#candles[i];
      const previous = this.#candles[i - 1];

      deMaxSum += Math.max(current.high - previous.high, 0);
      deMinSum += Math.max(previous.low - current.low, 0);
    }

    const totalPressure = deMaxSum + deMinSum;

    // A dead market prints neither higher highs nor lower lows, leaving no pressure to weigh — the reading is neutral
    if (totalPressure === 0) {
      return this.setResult(0.5, replace);
    }

    return this.setResult(deMaxSum / totalPressure, replace);
  }
}
