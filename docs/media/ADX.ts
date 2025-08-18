import {DX, FasterDX} from '../DX/DX.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import type {FasterMovingAverage, MovingAverage} from '../MA/MovingAverage.js';
import type {FasterMovingAverageTypes, MovingAverageTypes} from '../MA/MovingAverageTypes.js';
import type {HighLowClose} from '../util/HighLowClose.js';
import {FasterWSMA, WSMA} from '../WSMA/WSMA.js';

/**
 * Average Directional Index (ADX)
 * Type: Momentum, Trend (using +DI & -DI), Volatility
 *
 * The ADX was developed by John Welles Wilder, Jr.. It is a lagging indicator; that is, a
 * trend must have established itself before the ADX will generate a signal that a trend is under way.
 *
 * ADX will range between 0 and 100 which makes it an oscillator. It is a smoothed average of the Directional Movement
 * Index (DMI / DX).
 *
 * Generally, ADX readings below 20 indicate trend weakness, and readings above 40 indicate trend strength.
 * A strong trend is indicated by readings above 50. ADX values of 75-100 signal an extremely strong trend.
 *
 * Interpretation:
 * If ADX increases, it means that volatility is increasing and indicating the beginning of a new trend.
 * If ADX decreases, it means that volatility is decreasing, and the current trend is slowing down and may even
 * reverse.
 * When +DI is above -DI, then there is more upward pressure than downward pressure in the market.
 *
 * Note:
 * The ADX calculation relies on the DX becoming stable before producing meaningful results.
 * For an interval of 5, at least 9 candles are required. The first 5 candles are used to stabilize the DX, which then generates the initial ADX value.
 * The subsequent 4 candles produce additional ADX values, allowing it to stabilize with 5 values for an interval of 5.
 *
 * @see https://www.investopedia.com/terms/a/adx.asp
 * @see https://en.wikipedia.org/wiki/Average_directional_movement_index
 * @see https://paperswithbacktest.com/wiki/wilders-adx-dmi-indicator-calculation-method
 * @see https://www.youtube.com/watch?v=n2J1H3NeF70
 * @see https://learn.tradimo.com/technical-analysis-how-to-work-with-indicators/adx-determing-the-strength-of-price-movement
 * @see https://medium.com/codex/algorithmic-trading-with-average-directional-index-in-python-2b5a20ecf06a
 */
export class ADX extends BigIndicatorSeries<HighLowClose> {
  private readonly dx: DX;
  private readonly smoothed: MovingAverage;

  constructor(
    public readonly interval: number,
    SmoothingIndicator: MovingAverageTypes = WSMA
  ) {
    super();
    this.smoothed = new SmoothingIndicator(this.interval);
    this.dx = new DX(this.interval, SmoothingIndicator);
  }

  get mdi() {
    return this.dx.mdi;
  }

  get pdi() {
    return this.dx.pdi;
  }

  override getRequiredInputs() {
    return this.smoothed.getRequiredInputs();
  }

  update(candle: HighLowClose, replace: boolean) {
    const result = this.dx.update(candle, replace);

    if (result !== null) {
      this.smoothed.update(result, replace);
    }

    if (this.smoothed.isStable) {
      return this.setResult(this.smoothed.getResultOrThrow(), replace);
    }

    return null;
  }
}

export class FasterADX extends NumberIndicatorSeries<HighLowClose<number>> {
  private readonly dx: FasterDX;
  private readonly smoothed: FasterMovingAverage;

  constructor(
    public readonly interval: number,
    SmoothingIndicator: FasterMovingAverageTypes = FasterWSMA
  ) {
    super();
    this.smoothed = new SmoothingIndicator(this.interval);
    this.dx = new FasterDX(interval, SmoothingIndicator);
  }

  get mdi(): number | void {
    return this.dx.mdi;
  }

  get pdi(): number | void {
    return this.dx.pdi;
  }

  override getRequiredInputs() {
    return this.smoothed.getRequiredInputs();
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const result = this.dx.update(candle, replace);

    if (result !== null) {
      this.smoothed.update(result, replace);
    }

    if (this.smoothed.isStable) {
      return this.setResult(this.smoothed.getResultOrThrow(), replace);
    }

    return null;
  }
}
