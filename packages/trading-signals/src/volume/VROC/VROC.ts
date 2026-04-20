import {TradingSignal, TrendIndicatorSeries} from '../../types/Indicator.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Volume Rate of Change (VROC)
 * Type: Volume
 *
 * The Volume Rate of Change (VROC) measures the percentage change in volume over a specified period. It helps identify
 * whether volume is increasing or decreasing relative to past volume levels, which can confirm price trends or signal
 * potential reversals.
 *
 * Formula:
 * VROC = ((Current Volume - Volume n periods ago) / Volume n periods ago) * 100
 *
 * @see https://www.investopedia.com/terms/v/volumerateofchange.asp
 */
export class VROC extends TrendIndicatorSeries {
  readonly #volumes: number[] = [];
  readonly #historyLength: number;

  public readonly interval: number;

  constructor(interval: number) {
    super();
    this.interval = interval;
    this.#historyLength = interval + 1;
  }

  override getRequiredInputs() {
    return this.#historyLength;
  }

  update(volume: number, replace: boolean) {
    pushUpdate(this.#volumes, replace, volume, this.#historyLength);

    if (this.#volumes.length < this.#historyLength) {
      return null;
    }

    const previousVolume = this.#volumes[0];

    if (previousVolume === 0) {
      return this.setResult(0, replace);
    }

    const vroc = ((volume - previousVolume) / previousVolume) * 100;

    return this.setResult(vroc, replace);
  }

  protected calculateSignalState(result: number | null | undefined) {
    if (result === null || result === undefined) {
      return TradingSignal.UNKNOWN;
    }

    if (result > 0) {
      return TradingSignal.BULLISH;
    }

    if (result < 0) {
      return TradingSignal.BEARISH;
    }

    return TradingSignal.SIDEWAYS;
  }
}
