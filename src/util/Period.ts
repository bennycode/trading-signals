import {Big, BigSource} from 'big.js';
import {Indicator} from '../Indicator';
import {getFixedArray} from './getFixedArray';
import {getMinimum} from './getMinimum';
import {getMaximum} from './getMaximum';

export class Period implements Indicator {
  public values: Big[];
  /** Highest return value during the current period. */
  public highest?: Big;
  /** Lowest return value during the current period. */
  public lowest?: Big;

  constructor(public readonly interval: number) {
    this.values = getFixedArray<Big>(interval);
  }

  getResult(): Big {
    return this.values[this.values.length - 1];
  }

  update(value: BigSource): void {
    this.values.push(new Big(value));
    if (this.isStable) {
      this.lowest = getMinimum(this.values);
      this.highest = getMaximum(this.values);
    }
  }

  get isStable(): boolean {
    return this.values.length === this.interval;
  }
}

export class FasterPeriod implements Indicator<number> {
  public values: number[];
  /** Highest return value during the current period. */
  public highest?: number;
  /** Lowest return value during the current period. */
  public lowest?: number;

  constructor(public readonly interval: number) {
    this.values = getFixedArray<number>(interval);
  }

  getResult(): number {
    return this.values[this.values.length - 1];
  }

  update(value: number): void {
    this.values.push(value);
    if (this.isStable) {
      this.lowest = Math.min(...this.values);
      this.highest = Math.max(...this.values);
    }
  }

  get isStable(): boolean {
    return this.values.length === this.interval;
  }
}
