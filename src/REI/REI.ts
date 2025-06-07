import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import type {HighLowClose} from '../util/HighLowClose.js';

/**
 * Range Expansion Index (REI)
 * Type: Momentum
 *
 * The Range Expansion Index (REI) is a momentum oscillator, measuring the velocity and magnitude of directional price movements. Developed by Thomas DeMark, it compares the current day's range to the average range over a given period. It quantifies whether the current price range represents a contraction or expansion compared to the average. The REI is most typically used on an 8 day timeframe. Extreme REI values often signal potential reversal points, as they reflect sharp directional moves that may not be sustainable.
 *
 * Interpretation:
 * According to Thomas DeMark, potential shifts in momentum when the REI rises above +60 and then drops below (price weakness). Conversely, when it falls below -60 and then climbs back above, it may signal price strength.
 *
 * - REI > +60: Overbought condition — strong upward momentum that may be unsustainable
 * - REI between +60 and -60: Neutral zone — no extreme momentum detected
 * - REI < -60: Oversold condition — strong downward momentum that could reverse
 *
 * @see https://en.wikipedia.org/wiki/Range_expansion_index
 * @see https://www.quantifiedstrategies.com/range-expansion-index/
 * @see https://www.prorealcode.com/prorealtime-indicators/range-expansion-index-rei/
 * @see https://github.com/EarnForex/Range-Expansion-Index
 */
export class REI extends BigIndicatorSeries<HighLowClose> {
  private readonly highs: Big[] = [];
  private readonly lows: Big[] = [];
  private readonly closes: Big[] = [];

  constructor(public readonly interval: number = 8) {
    super();
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
    if (this.highs.length < this.interval + 8) {
      return null;
    }

    // Calculate sum for the interval period
    let subValueSum = new Big(0);
    let absValueSum = new Big(0);

    // Current position
    for (let j = 0; j < this.interval; j++) {
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

    if (absValueSum.eq(0)) {
      // Prevent division by 0
      return null;
    }
    const rei = subValueSum.div(absValueSum).times(100);
    return this.setResult(rei, replace);
  }
}

export class FasterREI extends NumberIndicatorSeries<HighLowClose<number>> {
  private readonly highs: number[] = [];
  private readonly lows: number[] = [];
  private readonly closes: number[] = [];

  constructor(public readonly interval: number = 8) {
    super();
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
    if (this.highs.length < this.interval + 8) {
      return null;
    }

    // Calculate sum for the interval period
    let subValueSum = 0;
    let absValueSum = 0;

    // Current position
    const currentIndex = this.highs.length - 1;

    for (let i = 0; i < this.interval; i++) {
      const pos = currentIndex - i;

      // For each position in the interval, calculate formula components
      const pos2Index = pos - 2;
      const pos5Index = pos - 5;
      const pos6Index = pos - 6;
      const pos7Index = pos - 7;
      const pos8Index = pos - 8;

      const posDiff1 = this.highs[pos] - this.highs[pos2Index];
      const posDiff2 = this.lows[pos] - this.lows[pos2Index];

      const posNumzero1Condition1 =
        this.highs[pos2Index] < this.closes[pos7Index] && this.highs[pos2Index] < this.closes[pos8Index];
      const posNumzero1Condition2 = this.highs[pos] < this.highs[pos5Index] && this.highs[pos] < this.highs[pos6Index];
      const posNumzero1 = posNumzero1Condition1 && posNumzero1Condition2 ? 0 : 1;

      const posNumzero2Condition1 =
        this.lows[pos2Index] > this.closes[pos7Index] && this.lows[pos2Index] > this.closes[pos8Index];
      const posNumzero2Condition2 = this.lows[pos] > this.lows[pos5Index] && this.lows[pos] > this.lows[pos6Index];
      const posNumzero2 = posNumzero2Condition1 && posNumzero2Condition2 ? 0 : 1;

      const posSubvalue = posNumzero1 * posNumzero2 * (posDiff1 + posDiff2);
      const posAbsValue = Math.abs(posDiff1) + Math.abs(posDiff2);

      subValueSum += posSubvalue;
      absValueSum += posAbsValue;
    }

    // Calculate REI
    let reiValue;
    if (absValueSum === 0) {
      reiValue = 0;
    } else {
      reiValue = (subValueSum / absValueSum) * 100;
    }

    return this.setResult(reiValue, replace);
  }
}
