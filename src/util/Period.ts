import {Big, BigSource} from '../index.js';
import {Indicator} from '../Indicator.js';
import {getFixedArray} from './getFixedArray.js';
import {getMinimum} from './getMinimum.js';
import {getMaximum} from './getMaximum.js';

export interface PeriodResult {
  highest: Big;
  lowest: Big;
}

export interface FasterPeriodResult {
  highest: number;
  lowest: number;
}

export class Period implements Indicator<PeriodResult> {
  public values: Big[];
  /** Highest return value during the current period. */
  public highest?: Big;
  /** Lowest return value during the current period. */
  public lowest?: Big;

  constructor(public readonly interval: number) {
    this.values = getFixedArray<Big>(interval);
  }

  getResult(): PeriodResult {
    return {
      highest: this.highest!,
      lowest: this.lowest!,
    };
  }

  update(value: BigSource): PeriodResult | void {
    this.values.push(new Big(value));
    if (this.isStable) {
      this.lowest = getMinimum(this.values);
      this.highest = getMaximum(this.values);
      return this.getResult();
    }
  }

  get isStable(): boolean {
    return this.values.length === this.interval;
  }
}

export class FasterPeriod implements Indicator<FasterPeriodResult> {
  public values: number[];
  /** Highest return value during the current period. */
  public highest?: number;
  /** Lowest return value during the current period. */
  public lowest?: number;

  constructor(public readonly interval: number) {
    this.values = getFixedArray<number>(interval);
  }

  getResult(): FasterPeriodResult {
    return {
      highest: this.highest!,
      lowest: this.lowest!,
    };
  }

  update(value: number): FasterPeriodResult | void {
    this.values.push(value);
    if (this.isStable) {
      this.lowest = Math.min(...this.values);
      this.highest = Math.max(...this.values);
      return this.getResult();
    }
  }

  get isStable(): boolean {
    return this.values.length === this.interval;
  }
}
