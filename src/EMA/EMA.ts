import type {BigSource} from 'big.js';
import {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage.js';
import {NotEnoughDataError} from '../error/index.js';
import Big from 'big.js';

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

  constructor(public override readonly interval: number) {
    super(interval);
    this.weightFactor = 2 / (this.interval + 1);
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(_price: BigSource, replace: boolean): Big {
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

  override getResultOrThrow(): Big {
    if (this.pricesCounter < this.interval) {
      throw new NotEnoughDataError(this.getRequiredInputs());
    }

    return this.result!;
  }

  override get isStable(): boolean {
    try {
      this.getResultOrThrow();
      return true;
    } catch {
      return false;
    }
  }
}

export class FasterEMA extends FasterMovingAverage {
  private pricesCounter = 0;
  private readonly weightFactor: number;

  constructor(public override readonly interval: number) {
    super(interval);
    this.weightFactor = 2 / (this.interval + 1);
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean): number {
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

  override getResultOrThrow(): number {
    if (this.pricesCounter < this.interval) {
      throw new NotEnoughDataError(this.getRequiredInputs());
    }

    return this.result!;
  }

  override get isStable(): boolean {
    try {
      this.getResultOrThrow();
      return true;
    } catch {
      return false;
    }
  }
}
