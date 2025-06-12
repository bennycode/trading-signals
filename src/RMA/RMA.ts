import type {BigSource} from 'big.js';
import {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage.js';
import {NotEnoughDataError} from '../error/index.js';
import Big from 'big.js';

/**
 * Relative Moving Average (RMA)
 * Type: Trend
 *
 * Use RMA to identify bullish or bearish trends. It provides a smoother curve compared to SMA and EMA, reacting more slowly to price changes.
 *
 * @see https://www.tradingcode.net/tradingview/ema-versus-rma/
 * @see https://www.tradingcode.net/tradingview/relative-moving-average/#calculation-process
 */
export class RMA extends MovingAverage {
  private pricesCounter = 0;
  private readonly weightFactor: number;

  constructor(public override readonly interval: number) {
    super(interval);
    this.weightFactor = 1 / this.interval;
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

export class FasterRMA extends FasterMovingAverage {
  private pricesCounter = 0;
  private readonly weightFactor: number;

  constructor(public override readonly interval: number) {
    super(interval);
    this.weightFactor = 1 / this.interval;
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
