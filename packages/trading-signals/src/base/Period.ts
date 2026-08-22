import {IndicatorInputShape} from '../base/Indicator.js';
import {TechnicalIndicator} from './Indicator.js';
import {pushUpdate} from '../util/array/pushUpdate.js';

export type PeriodResult = {
  highest: number;
  lowest: number;
};

export class Period extends TechnicalIndicator<PeriodResult, number> {
  override readonly inputShape = IndicatorInputShape.VALUE;

  public values: number[];
  /** Highest return value during the current period. */
  #highest?: number;
  /** Lowest return value during the current period. */
  #lowest?: number;

  get highest() {
    return this.#highest;
  }

  get lowest() {
    return this.#lowest;
  }

  public readonly interval: number;

  constructor(interval: number) {
    super();
    this.interval = interval;
    this.values = [];
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(value: number, replace: boolean) {
    pushUpdate({array: this.values, item: value, maxLength: this.interval, replace: replace});

    if (this.values.length === this.interval) {
      this.#lowest = Math.min(...this.values);
      this.#highest = Math.max(...this.values);
      return (this.result = {
        highest: this.#highest,
        lowest: this.#lowest,
      });
    }

    return null;
  }
}
