import type {BigSource} from 'big.js';
import Big from 'big.js';
import {TechnicalIndicator} from '../Indicator.js';
import {getFixedArray} from './getFixedArray.js';
import {getMaximum} from './getMaximum.js';
import {getMinimum} from './getMinimum.js';
import {pushUpdate} from './pushUpdate.js';

export interface PeriodResult {
  highest: Big;
  lowest: Big;
}

export interface FasterPeriodResult {
  highest: number;
  lowest: number;
}

export class Period extends TechnicalIndicator<PeriodResult, BigSource> {
  private readonly values: Big[];
  /** Highest return value during the current period. */
  private _highest?: Big;
  /** Lowest return value during the current period. */
  private _lowest?: Big;

  get highest() {
    return this._highest;
  }

  get lowest() {
    return this._lowest;
  }

  constructor(public readonly interval: number) {
    super();
    this.values = getFixedArray<Big>(interval);
  }

  update(value: BigSource, replace: boolean = false): PeriodResult | void {
    pushUpdate(this.values, replace, new Big(value));

    if (this.values.length === this.interval) {
      this._lowest = getMinimum(this.values);
      this._highest = getMaximum(this.values);
      return (this.result = {
        highest: this._highest,
        lowest: this._lowest,
      });
    }
  }
}

export class FasterPeriod extends TechnicalIndicator<FasterPeriodResult, number> {
  public values: number[];
  /** Highest return value during the current period. */
  private _highest?: number;
  /** Lowest return value during the current period. */
  private _lowest?: number;

  get highest() {
    return this._highest;
  }

  get lowest() {
    return this._lowest;
  }

  constructor(public readonly interval: number) {
    super();
    this.values = getFixedArray<number>(interval);
  }

  update(value: number, replace: boolean = false): FasterPeriodResult | void {
    pushUpdate(this.values, replace, value);

    if (this.values.length === this.interval) {
      this._lowest = Math.min(...this.values);
      this._highest = Math.max(...this.values);
      return (this.result = {
        highest: this._highest,
        lowest: this._lowest,
      });
    }
  }
}
