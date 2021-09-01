import Big, {BigSource} from 'big.js';
import {EMA, SMA} from '..';
import {MovingAverage} from '../MA/MovingAverage';
import {Indicator} from '../Indicator';

export type DMAResult = {long: Big; short: Big};

export class DMA implements Indicator<DMAResult> {
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

  update(price: BigSource): void {
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
