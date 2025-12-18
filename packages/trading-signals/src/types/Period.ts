import {TechnicalIndicator} from './Indicator.js';
import {pushUpdate} from '../util/pushUpdate.js';

export interface PeriodResult {
  highest: number;
  lowest: number;
}

export class Period extends TechnicalIndicator<PeriodResult, number> {
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

  constructor(public readonly interval: number) {
    super();
    this.values = [];
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(value: number, replace: boolean) {
    pushUpdate(this.values, replace, value, this.interval);

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
