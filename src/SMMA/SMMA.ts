import Big, {BigSource} from 'big.js';
import {SMA} from '../';
import {MovingAverage} from '../MA/MovingAverage';

/**
 * Smoothed Moving Average (SMMA)
 * Type: Trend
 *
 * The Smoothed Moving Average (SMMA) has a much larger delay than the SMA or EMA. It is ideal for long-term trend validation.
 *
 * @see https://www.chartmill.com/documentation/technical-analysis-indicators/217-MOVING-AVERAGES-%7C-The-Smoothed-Moving-Average-%28SMMA%29
 */
class SMMA extends MovingAverage {
  public readonly prices: Big[] = [];
  private readonly sma: SMA;

  constructor(public readonly interval: number) {
    super(interval);
    this.sma = new SMA(interval);
  }

  override update(price: BigSource): Big | void {
    this.prices.push(new Big(price));

    if (this.prices.length < this.interval) {
      this.sma.update(price);
    } else if (this.prices.length === this.interval) {
      this.sma.update(price);
      this.setResult(this.sma.getResult());
    } else {
      this.setResult(
        this.getResult()
          .times(this.interval - 1)
          .add(price)
          .div(this.interval)
      );
    }

    if (this.prices.length > this.interval) {
      this.prices.shift();
    }

    return this.result;
  }

  override getResult(): Big {
    return this.result || new Big(0);
  }
}

export {SMMA};
