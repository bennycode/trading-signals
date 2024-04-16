import {Big, type BigSource} from '../index.js';
import {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage.js';
import {NotEnoughDataError} from '../error/index.js';

/**
 * Exponential Moving Average (EMA)
 * Type: Trend
 *
 * Compared to SMA, the EMA puts more emphasis on the recent prices to reduce lag. Due to its responsiveness to price
 * changes, it rises faster and falls faster than the SMA when the price is inclining or declining.
 *
 * @see https://www.investopedia.com/terms/e/ema.asp
 */
export class EMA extends MovingAverage {
  private pricesCounter = 0;
  private readonly weightFactor: number;

  constructor(public readonly interval: number) {
    super(interval);
    this.weightFactor = 2 / (this.interval + 1);
  }

  update(_price: BigSource, replace: boolean = false): Big {
    if (!replace) {
      this.pricesCounter++;
    } else if (replace && this.pricesCounter === 0) {
      this.pricesCounter++;
    }
    const price = new Big(_price);

    if (replace && this.previousResult) {
      return this.setResult(
        price.times(this.weightFactor).add(this.previousResult.times(1 - this.weightFactor)),
        replace
      );
    }
    return this.setResult(
      price.times(this.weightFactor).add((this.result ?? price).times(1 - this.weightFactor)),
      replace
    );
  }

  override getResult(): Big {
    if (this.pricesCounter < this.interval) {
      throw new NotEnoughDataError();
    }

    return this.result!;
  }

  override get isStable(): boolean {
    try {
      this.getResult();
      return true;
    } catch {
      return false;
    }
  }
}

export class FasterEMA extends FasterMovingAverage {
  private pricesCounter = 0;
  private readonly weightFactor: number;

  constructor(public readonly interval: number) {
    super(interval);
    this.weightFactor = 2 / (this.interval + 1);
  }

  update(price: number, replace: boolean = false): number {
    if (!replace) {
      this.pricesCounter++;
    } else if (replace && this.pricesCounter === 0) {
      this.pricesCounter++;
    }

    if (replace && this.previousResult !== undefined) {
      return this.setResult(price * this.weightFactor + this.previousResult * (1 - this.weightFactor), replace);
    }
    return this.setResult(
      price * this.weightFactor + (this.result !== undefined ? this.result : price) * (1 - this.weightFactor),
      replace
    );
  }

  override getResult(): number {
    if (this.pricesCounter < this.interval) {
      throw new NotEnoughDataError();
    }

    return this.result!;
  }

  override get isStable(): boolean {
    try {
      this.getResult();
      return true;
    } catch {
      return false;
    }
  }
}
