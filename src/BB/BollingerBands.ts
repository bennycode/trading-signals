import Big, {BigSource} from 'big.js';
import {SMA} from '../SMA/SMA';
import {NotEnoughDataError} from '../error';

export type BollingerBandsResult = {
  lower: Big;
  middle: Big;
  upper: Big;
};

export class BollingerBands {
  public readonly interval: number;
  public readonly deviationMultiplier: number;
  private readonly middleSMA: SMA;
  private readonly prices: Big[] = [];
  private result: BollingerBandsResult | undefined;

  constructor(interval: number = 0, deviationMultiplier: number = 2) {
    this.interval = interval;
    this.deviationMultiplier = deviationMultiplier;
    this.middleSMA = new SMA(this.interval);
  }

  get isStable(): boolean {
    return this.prices.length >= this.interval;
  }

  update(_price: BigSource): void {
    const price = new Big(_price);

    this.middleSMA.update(price);
    this.prices.push(price);

    while (this.prices.length > this.interval) {
      this.prices.shift();
    }

    if (!this.isStable) {
      return;
    }

    const avg = this.middleSMA.getResult();
    const squareDiffs = this.prices.map((price: Big) => price.sub(avg).pow(2));
    const standardDeviation = this.getAverage(squareDiffs).sqrt();

    this.result = {
      lower: avg.sub(standardDeviation.times(this.deviationMultiplier)),
      middle: avg,
      upper: avg.add(standardDeviation.times(this.deviationMultiplier)),
    };
  }

  getResult(): BollingerBandsResult {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  private getAverage(values: Big[]): Big {
    const sum = values.reduce((prev: Big, current: Big) => {
      return prev.add(current);
    }, new Big(0));

    return sum.div(values.length);
  }
}
