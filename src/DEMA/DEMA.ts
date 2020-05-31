import Big, {BigSource} from 'big.js';
import {EMA} from '..';

export class DEMA {
  public readonly long: EMA;
  public readonly short: EMA;

  constructor(short: number, long: number) {
    this.short = new EMA(short);
    this.long = new EMA(long);
  }

  update(_price: BigSource): void {
    const price = new Big(_price);

    this.short.update(price);
    this.long.update(price);
  }

  getResult(): {long: Big; short: Big} {
    return {
      long: this.long.getResult(),
      short: this.short.getResult(),
    };
  }
}
