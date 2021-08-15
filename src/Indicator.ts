import type Big from 'big.js';

export interface Indicator<T> {
  getResult(): T;

  isStable: boolean;

  update(...args: any): void;
}

export abstract class SimpleIndicator implements Indicator<Big> {
  highest?: Big;
  lowest?: Big;
  protected result?: Big;

  abstract isStable: boolean;

  abstract getResult(): Big;

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

  abstract update(...args: any): void;
}
