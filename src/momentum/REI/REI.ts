import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../../Indicator.js';
import type {HighLowClose} from '../../util/HighLowClose.js';

/**
 * Range Expansion Index (REI)
 * Type: Momentum Oscillator
 *
 * The Range Expansion Index (REI) is a momentum oscillator, measuring the velocity and magnitude of directional price movements. Developed by Thomas DeMark, it compares the current day's range to the average range over a given period. It quantifies whether the current price range represents a contraction or expansion compared to the average. The REI is most typically used on an 8 day timeframe. Extreme REI values often signal potential reversal points, as they reflect sharp directional moves that may not be sustainable.
 *
 * Interpretation:
 * According to Thomas DeMark, potential shifts in momentum when the REI rises above +60 and then drops below (price weakness). Conversely, when it falls below -60 and then climbs back above, it may signal price strength.
 *
 * - REI > +60: Overbought condition — strong upward momentum that may be unsustainable (when crossed from above)
 * - REI between +60 and -60: Neutral zone — the market is neither gaining upward strength nor showing downside pressure
 * - REI < -60: Oversold condition — strong downward momentum that could reverse (when crossed from below)
 *
 * @see https://en.wikipedia.org/wiki/Range_expansion_index
 * @see https://www.quantifiedstrategies.com/range-expansion-index/
 * @see https://www.prorealcode.com/prorealtime-indicators/range-expansion-index-rei/
 * @see https://github.com/EarnForex/Range-Expansion-Index
 * @see https://www.sierrachart.com/index.php?page=doc/StudiesReference.php&ID=448
 */
export class REI extends BigIndicatorSeries<HighLowClose> {
  private readonly highs: Big[] = [];
  private readonly lows: Big[] = [];
  private readonly closes: Big[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override getRequiredInputs() {
    return this.interval + 8;
  }

  private calculateN(j: number) {
    if (
      this.highs[j - 2].lt(this.closes[j - 7]) &&
      this.highs[j - 2].lt(this.closes[j - 8]) &&
      this.highs[j].lt(this.highs[j - 5]) &&
      this.highs[j].lt(this.highs[j - 6])
    ) {
      return new Big(0);
    }
    return new Big(1);
  }

  private calculateM(j: number) {
    if (
      this.lows[j - 2].gt(this.closes[j - 7]) &&
      this.lows[j - 2].gt(this.closes[j - 8]) &&
      this.lows[j].gt(this.lows[j - 5]) &&
      this.lows[j].gt(this.lows[j - 6])
    ) {
      return new Big(0);
    }
    return new Big(1);
  }

  override update(candle: HighLowClose, replace: boolean) {
    if (replace) {
      this.highs.pop();
      this.lows.pop();
      this.closes.pop();
    }

    this.highs.push(new Big(candle.high));
    this.lows.push(new Big(candle.low));
    this.closes.push(new Big(candle.close));

    // We need at least interval + 8 candles for REI calculation
    // REI uses data from prior periods for comparison
    if (this.highs.length < this.getRequiredInputs()) {
      return null;
    }

    // Calculate sum for the interval period
    let subValueSum = new Big(0);
    let absValueSum = new Big(0);

    const limitIndex = this.highs.length - 1;

    for (let j = limitIndex; j > this.interval; j--) {
      const diff1 = this.highs[j].minus(this.highs[j - 2]);
      const diff2 = this.lows[j].minus(this.lows[j - 2]);

      const n = this.calculateN(j);
      const m = this.calculateM(j);
      const s = diff1.plus(diff2);

      const subValue = n.times(m).times(s);
      const absDailyValue = diff1.abs().plus(diff2.abs());

      subValueSum = subValueSum.plus(subValue);
      absValueSum = absValueSum.plus(absDailyValue);
    }

    // Prevent division by 0
    if (absValueSum.eq(0)) {
      return this.setResult(new Big(0), replace);
    }
    const rei = subValueSum.div(absValueSum).times(100);
    return this.setResult(rei, replace);
  }
}

export class FasterREI extends NumberIndicatorSeries<HighLowClose<number>> {
  private readonly highs: number[] = [];
  private readonly lows: number[] = [];
  private readonly closes: number[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  override getRequiredInputs() {
    return this.interval + 8;
  }

  private calculateN(j: number) {
    if (
      this.highs[j - 2] < this.closes[j - 7] &&
      this.highs[j - 2] < this.closes[j - 8] &&
      this.highs[j] < this.highs[j - 5] &&
      this.highs[j] < this.highs[j - 6]
    ) {
      return 0;
    }
    return 1;
  }

  private calculateM(j: number) {
    if (
      this.lows[j - 2] > this.closes[j - 7] &&
      this.lows[j - 2] > this.closes[j - 8] &&
      this.lows[j] > this.lows[j - 5] &&
      this.lows[j] > this.lows[j - 6]
    ) {
      return 0;
    }
    return 1;
  }

  override update(candle: HighLowClose<number>, replace: boolean) {
    if (replace) {
      this.highs.pop();
      this.lows.pop();
      this.closes.pop();
    }

    this.highs.push(candle.high);
    this.lows.push(candle.low);
    this.closes.push(candle.close);

    // We need at least interval + 8 candles for REI calculation
    // REI uses data from prior periods for comparison
    if (this.highs.length < this.getRequiredInputs()) {
      return null;
    }

    // Calculate sum for the interval period
    let subValueSum = 0;
    let absValueSum = 0;

    const limitIndex = this.highs.length - 1;

    for (let j = limitIndex; j > this.interval; j--) {
      const diff1 = this.highs[j] - this.highs[j - 2];
      const diff2 = this.lows[j] - this.lows[j - 2];

      const n = this.calculateN(j);
      const m = this.calculateM(j);
      const s = diff1 + diff2;

      const subValue = n * m * s;
      const absDailyValue = Math.abs(diff1) + Math.abs(diff2);

      subValueSum += subValue;
      absValueSum += absDailyValue;
    }

    // Prevent division by 0
    if (absValueSum === 0) {
      return this.setResult(0, replace);
    }

    const rei = (subValueSum / absValueSum) * 100;
    return this.setResult(rei, replace);
  }
}
