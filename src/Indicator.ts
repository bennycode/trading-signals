import Big from 'big.js';

export interface FasterIndicator<T = number> {
  getResult(): T;

  isStable: boolean;

  update(price: number): void | T;
}

export interface Indicator<T = Big> {
  getResult(): T;

  isStable: boolean;

  update(...args: any): void;
}

export abstract class SimpleIndicator implements Indicator {
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
