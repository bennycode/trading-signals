import type Big from 'big.js';

export interface Indicator<T> {
  getResult(): T;

  isStable: boolean;

  update(...args: any): void;
}

export interface SimpleIndicator extends Indicator<Big> {}
