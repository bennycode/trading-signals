import {IndicatorSeries} from '../../types/Indicator.js';
import type {MovingAverage} from '../../trend/MA/MovingAverage.js';
import type {MovingAverageTypes} from '../../trend/MA/MovingAverageTypes.js';
import {TR} from '../TR/TR.js';
import type {HighLowClose} from '../../types/HighLowClose.js';
import {WSMA} from '../../trend/WSMA/WSMA.js';

/**
 * Average True Range (ATR)
 * Type: Volatility
 *
 * The ATR was developed by John Welles Wilder (Jr.). The idea of ranges is that they show the commitment or enthusiasm of traders. Large or increasing ranges suggest traders prepared to continue to bid up or sell down a stock through the course of the day. Decreasing range indicates declining interest.
 *
 * A stock with a higher ATR is indicative of increased volatility, while a lower ATR suggests decreased volatility during the assessed time frame.
 *
 * - Low ATR (e.g., 0.5 to 1): Typically associated with low-volatility stocks or markets. Prices tend to move in a relatively calm and steady manner.
 *
 * - Moderate ATR (e.g., 1 to 2): Indicates moderate volatility. Prices may experience periodic fluctuations, but they are not extreme. Many traders find stocks with ATR around 2 to be suitable for trading with manageable risk.
 *
 * - High ATR (e.g., 2 or higher): Suggests higher volatility. Stocks with ATR values greater than 2 are prone to more significant price swings, and they may exhibit larger price movements.
 *
 * @see https://www.investopedia.com/terms/a/atr.asp
 */
export class ATR extends IndicatorSeries<HighLowClose<number>> {
  private readonly tr: TR;
  private readonly smoothing: MovingAverage;

  constructor(
    public readonly interval: number,
    SmoothingIndicator: MovingAverageTypes = WSMA
  ) {
    super();
    this.tr = new TR();
    this.smoothing = new SmoothingIndicator(interval);
  }

  override getRequiredInputs() {
    return this.smoothing.getRequiredInputs();
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const trueRange = this.tr.update(candle, replace);
    this.smoothing.update(trueRange, replace);
    if (this.smoothing.isStable) {
      return this.setResult(this.smoothing.getResultOrThrow(), replace);
    }

    return null;
  }
}
