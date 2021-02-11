import Big from 'big.js';

export interface Indicator {
  getResult(): any;

  isStable: boolean;

  update(...args: any): void;
}

export interface SimpleIndicator extends Indicator {
  getResult(): Big;
}
