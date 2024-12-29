import {Big, NotEnoughDataError, pushUpdate, type BigSource} from '../index.js';
import type {Indicator} from '../Indicator.js';
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
    this.values = getFixedArray<Big>(interval);
  }

  replace(input: Big.BigSource) {
    return this.update(input, true);
  }

  getResult(): PeriodResult {
    if (!this._lowest || !this._highest) {
      throw new NotEnoughDataError();
    }

    return {
      highest: this._highest,
      lowest: this._lowest,
    };
  }

  updates(values: BigSource[]) {
    // TODO: Use foreach with last
    values.forEach(value => this.update(value));
  }

  update(value: BigSource, replace: boolean = false): PeriodResult | void {
    pushUpdate(this.values, replace, new Big(value));

    if (this.isStable) {
      this._lowest = getMinimum(this.values);
      this._highest = getMaximum(this.values);
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
    this.values = getFixedArray<number>(interval);
  }

  replace(input: number): void | FasterPeriodResult {
    return this.update(input, true);
  }

  updates(values: number[]) {
    values.forEach(value => this.update(value));
  }

  getResult(): FasterPeriodResult {
    if (!this._lowest || !this._highest) {
      throw new NotEnoughDataError();
    }

    return {
      highest: this._highest,
      lowest: this._lowest,
    };
  }

  update(value: number, replace: boolean = false): FasterPeriodResult | void {
    pushUpdate(this.values, replace, value);

    if (this.isStable) {
      this._lowest = Math.min(...this.values);
      this._highest = Math.max(...this.values);
      return this.getResult();
    }
  }

  get isStable(): boolean {
    return this.values.length === this.interval;
  }
}
