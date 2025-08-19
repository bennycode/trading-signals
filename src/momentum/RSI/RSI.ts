import {IndicatorSeries} from '../../types/Indicator.js';
import type {MovingAverage} from '../../trend/MA/MovingAverage.js';
import type {MovingAverageTypes} from '../../trend/MA/MovingAverageTypes.js';
import {pushUpdate} from '../../util/pushUpdate.js';
import {WSMA} from '../../trend/WSMA/WSMA.js';

/**
 * Relative Strength Index (RSI)
 * Type: Momentum
 *
 * The Relative Strength Index (RSI) is an oscillator that ranges between 0 and 100. The RSI can be used to find trend reversals, i.e. when a downtrend doesn't generate a RSI below 30 and rallies above 70 it could mean that a trend reversal to the upside is taking place. Trend lines and moving averages should be used to validate such statements.
 *
 * The RSI is mostly useful in markets that alternate between bullish and bearish movements.
 *
 * Interpretation:
 * A RSI value of 30 or below indicates an oversold condition (not a good time to sell because there is an oversupply).
 * A RSI value of 70 or above indicates an overbought condition (sell high opportunity because market may correct the price in the near future).
 *
 * @see https://en.wikipedia.org/wiki/Relative_strength_index
 * @see https://www.investopedia.com/terms/r/rsi.asp
 */
export class RSI extends IndicatorSeries {
  private readonly previousPrices: number[] = [];
  private readonly avgGain: MovingAverage;
  private readonly avgLoss: MovingAverage;
  private readonly maxValue = 100;

  constructor(
    public readonly interval: number,
    SmoothingIndicator: MovingAverageTypes = WSMA
  ) {
    super();
    this.avgGain = new SmoothingIndicator(this.interval);
    this.avgLoss = new SmoothingIndicator(this.interval);
  }

  override getRequiredInputs() {
    return this.avgGain.getRequiredInputs();
  }

  update(price: number, replace: boolean) {
    pushUpdate(this.previousPrices, replace, price, this.interval);

    // Ensure at least 2 prices are available for calculation
    if (this.previousPrices.length < 2) {
      return null;
    }

    const currentPrice = price;
    const previousPrice = this.previousPrices[this.previousPrices.length - 2];

    if (currentPrice > previousPrice) {
      this.avgLoss.update(0, replace);
      this.avgGain.update(price - previousPrice, replace);
    } else {
      this.avgLoss.update(previousPrice - currentPrice, replace);
      this.avgGain.update(0, replace);
    }

    if (this.avgGain.isStable) {
      const avgLoss = this.avgLoss.getResultOrThrow();
      // Prevent division by zero: https://github.com/bennycode/trading-signals/issues/378
      if (avgLoss === 0) {
        return this.setResult(100, replace);
      }
      const relativeStrength = this.avgGain.getResultOrThrow() / avgLoss;
      return this.setResult(this.maxValue - this.maxValue / (relativeStrength + 1), replace);
    }

    return null;
  }
}
