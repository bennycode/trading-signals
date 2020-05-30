import Big, {BigSource} from 'big.js';
import {SMMA} from '..';

export class RSI {
  private readonly interval: number;
  private readonly prices: Big[] = [];
  private result: Big;

  private readonly avgGain: SMMA;
  private readonly avgLoss: SMMA;

  constructor(interval: number) {
    this.interval = interval;

    this.avgGain = new SMMA(this.interval);
    this.avgLoss = new SMMA(this.interval);

    this.result = new Big(0);
  }

  update(price: BigSource): void {
    const currentClose = new Big(price);
    this.prices.push(currentClose);

    // at least 2 prices are required to do a calculation
    if (this.prices.length === 1) {
      return;
    }

    const lastClose = this.prices[this.prices.length - 2];

    // Update average gain/loss
    if (currentClose.gt(lastClose)) {
      this.avgLoss.update(new Big(0)); // price went up, therefore no loss
      this.avgGain.update(currentClose.sub(lastClose));
    } else {
      this.avgLoss.update(lastClose.sub(currentClose));
      this.avgGain.update(new Big(0)); // price went down, therefore no gain
    }

    // as long as there are not enough values as the required interval, the result should always be 0
    if (this.prices.length <= this.interval) {
      this.result = new Big(0);
      return;
    }

    const relativeStrength = this.avgLoss.getResult().eq(new Big(0))
      ? new Big(100)
      : this.avgGain.getResult().div(this.avgLoss.getResult());

    const max = new Big(100);
    this.result = max.minus(max.div(relativeStrength.add(1)));

    this.prices.shift();
  }

  getResult(): Big {
    return this.result;
  }
}
