import Big, {BigSource} from 'big.js';
import {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator';
import {FasterMovingAverageTypes, MovingAverageTypes} from '../MA/MovingAverageTypes';
import {FasterWSMA, WSMA} from '../WSMA/WSMA';

/**
 * Relative Strength Index (RSI)
 * Type: Momentum
 *
 * The Relative Strength Index (RSI) is an oscillator that ranges between 0 and 100. The RSI can be used to find trend
 * reversals, i.e. when a downtrend doesn't generate a RSI below 30 and rallies above 70 it could mean that a trend
 * reversal to the upside is taking place. Trend lines and moving averages should be used to validate such statements.
 *
 * The RSI is mostly useful in markets that alternate between bullish and bearish movements.
 *
 * A RSI value of 30 or below indicates an oversold condition (not a good time to sell because there is an oversupply).
 * A RSI value of 70 or above indicates an overbought condition (sell high opportunity because market may correct the
 * price in the near future).
 *
 * @see https://www.investopedia.com/terms/r/rsi.asp
 */
export class RSI extends BigIndicatorSeries {
  private previousPrice?: BigSource;
  private readonly avgGain: MovingAverage;
  private readonly avgLoss: MovingAverage;
  private readonly maxValue = new Big(100);

  constructor(public readonly interval: number, SmoothingIndicator: MovingAverageTypes = WSMA) {
    super();
    this.avgGain = new SmoothingIndicator(this.interval);
    this.avgLoss = new SmoothingIndicator(this.interval);
  }

  override update(price: BigSource): void | Big {
    if (!this.previousPrice) {
      // At least 2 prices are required to do a calculation
      this.previousPrice = price;
      return;
    }

    const currentPrice = new Big(price);
    const previousPrice = new Big(this.previousPrice);

    // Update average gain/loss
    if (currentPrice.gt(previousPrice)) {
      this.avgLoss.update(new Big(0)); // price went up, therefore no loss
      this.avgGain.update(currentPrice.sub(previousPrice));
    } else {
      this.avgLoss.update(previousPrice.sub(currentPrice));
      this.avgGain.update(new Big(0)); // price went down, therefore no gain
    }

    this.previousPrice = price;

    if (this.avgGain.isStable) {
      const relativeStrength = this.avgGain.getResult().div(this.avgLoss.getResult());
      return this.setResult(this.maxValue.minus(this.maxValue.div(relativeStrength.add(1))));
    }
  }
}

export class FasterRSI extends NumberIndicatorSeries {
  private previousPrice?: number;
  private readonly avgGain: FasterMovingAverage;
  private readonly avgLoss: FasterMovingAverage;
  private readonly maxValue = 100;

  constructor(public readonly interval: number, SmoothingIndicator: FasterMovingAverageTypes = FasterWSMA) {
    super();
    this.avgGain = new SmoothingIndicator(this.interval);
    this.avgLoss = new SmoothingIndicator(this.interval);
  }

  override update(price: number): void | number {
    if (!this.previousPrice) {
      this.previousPrice = price;
      return;
    }

    if (price > this.previousPrice) {
      this.avgLoss.update(0);
      this.avgGain.update(price - this.previousPrice);
    } else {
      this.avgLoss.update(this.previousPrice - price);
      this.avgGain.update(0);
    }

    this.previousPrice = price;

    if (this.avgGain.isStable) {
      const relativeStrength = this.avgGain.getResult() / this.avgLoss.getResult();
      return this.setResult(this.maxValue - this.maxValue / (relativeStrength + 1));
    }
  }
}
