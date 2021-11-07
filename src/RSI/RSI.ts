import Big, {BigSource} from 'big.js';
import {MovingAverageTypeContext, NotEnoughDataError, SMMA} from '..';
import {MovingAverage} from '../MA/MovingAverage';
import {BigIndicatorSeries} from '../Indicator';

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
 * A RSI value of 70 or above indicates an overbought condition (sell high opportunity because market may correct the price in the near future).
 *
 * @see https://www.investopedia.com/terms/r/rsi.asp
 */
export class RSI extends BigIndicatorSeries {
  public readonly prices: Big[] = [];
  private readonly avgGain: MovingAverage;
  private readonly avgLoss: MovingAverage;

  constructor(public readonly interval: number, Indicator: MovingAverageTypeContext = SMMA) {
    super();
    this.avgGain = new Indicator(this.interval);
    this.avgLoss = new Indicator(this.interval);
  }

  override update(price: BigSource): void {
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
      this.setResult(new Big(0));
      return;
    }

    const relativeStrength = this.avgLoss.getResult().eq(new Big(0))
      ? new Big(100)
      : this.avgGain.getResult().div(this.avgLoss.getResult());

    const max = new Big(100);
    this.setResult(max.minus(max.div(relativeStrength.add(1))));

    while (this.prices.length > this.interval) {
      this.prices.shift();
    }
  }

  override getResult(): Big {
    if (!this.isStable) {
      throw new NotEnoughDataError();
    }
    return this.result!;
  }

  override get isStable(): boolean {
    if (this.result) {
      return this.result.gt(0);
    }
    return false;
  }
}
