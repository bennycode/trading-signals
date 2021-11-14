import Big from 'big.js';
import {NotEnoughDataError} from './error';

export interface Indicator<T = Big> {
  getResult(): T;

  isStable: boolean;

  update(...args: any): void | T;
}

/** Defines indicators which only require a single value (usually the price) to get updated. */
export interface SimpleIndicator<T = Big> extends Indicator<T> {
  update(value: T): void | T;
}

export type SimpleNumberIndicator = SimpleIndicator<number>;

/**
 * Tracks results of an indicator over time and memorizes the highest & lowest result.
 */
export interface IndicatorSeries<T = Big> extends Indicator<T> {
  highest?: T;
  lowest?: T;
}

export abstract class BigIndicatorSeries implements IndicatorSeries {
  highest?: Big;
  lowest?: Big;
  protected result?: Big;

  get isStable(): boolean {
    return this.result !== undefined;
  }

  getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  protected setResult(value: Big): Big {
    this.result = value;

    if (!this.highest || value.gt(this.highest)) {
      this.highest = value;
    }

    if (!this.lowest || value.lt(this.lowest)) {
      this.lowest = value;
    }

    return this.result;
  }

  abstract update(...args: any): void | Big;
}

export abstract class NumberIndicatorSeries implements IndicatorSeries<number> {
  highest?: number;
  lowest?: number;
  protected result?: number;

  get isStable(): boolean {
    return this.result !== undefined;
  }

  getResult(): number {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  protected setResult(value: number): number {
    this.result = value;

    if (!this.highest || value > this.highest) {
      this.highest = value;
    }

    if (!this.lowest || value < this.lowest) {
      this.lowest = value;
    }

    return this.result;
  }

  abstract update(...args: any): void | number;
}
