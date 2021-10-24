import {NotEnoughDataError} from '../error';

export class FasterSMA {
  protected result?: number;
  public readonly prices: number[] = [];

  constructor(public readonly interval: number) {}

  isStable(): boolean {
    return this.prices.length === this.interval;
  }

  getResult(): number {
    if (!this.result) {
      throw new NotEnoughDataError();
    }
    return this.result;
  }

  update(price: number): number | void {
    this.prices.push(price);

    if (this.prices.length > this.interval) {
      this.prices.shift();
    }

    if (this.prices.length === this.interval) {
      const sum = this.prices.reduce((a, b) => a + b, 0);
      return (this.result = sum / this.prices.length);
    }
  }
}
