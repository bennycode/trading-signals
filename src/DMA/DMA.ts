import Big, {BigSource} from 'big.js';
import {EMA, SMA} from '..';
import {MovingAverage} from '../MA/MovingAverage';

export type DMAResult = {long: Big; short: Big};

export class DMA {
  public readonly long: MovingAverage;
  public readonly short: MovingAverage;
  private received: number = 0;

  constructor(short: number, long: number, Indicator: typeof EMA | typeof SMA = SMA) {
    this.short = new Indicator(short);
    this.long = new Indicator(long);
  }

  get isStable(): boolean {
    return this.received >= this.long.interval;
  }

  update(_price: BigSource): void {
    const price = new Big(_price);
    this.short.update(price);
    this.long.update(price);
    this.received += 1;
  }

  getResult(): DMAResult {
    return {
      long: this.long.getResult(),
      short: this.short.getResult(),
    };
  }
}
