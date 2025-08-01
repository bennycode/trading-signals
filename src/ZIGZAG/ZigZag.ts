import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import type {HighLow} from '../util/HighLowClose.js';
import {NotEnoughDataError} from '../error/index.js';

export type ZigZagConfig = {
  /**
   * The percentage change required to establish a new extreme point.
   * Typical values range from 3 to 12 (representing 3% to 12%).
   */
  deviation: number;
};

/**
 * ZigZag Indicator (ZigZag)
 * Type: Trend
 *
 * The ZigZag indicator is a technical analysis tool used to identify price trends by
 * filtering out smaller price movements. It works by identifying significant highs and lows
 * in a price series and drawing lines between them. For a high or low to be considered
 * significant, the price must reverse by at least a specified percentage (deviation) from the last
 * extreme point.
 *
 * The indicator alternates between tracking highs and lows: after confirming a high, it searches for a
 * significant low, and after confirming a low, it searches for a significant high.
 *
 * A momentum investor might rely on the ZigZag indicator to remain in a trade until the Zig Zag line signals a reversal. For instance, if holding a long position, the investor would wait to sell until the Zig Zag line shifts downward. The Zig Zag indicator is considered a lagging indicator because its values are plotted only after each time period closes, and it only forms a permanent new line once the price has moved significantly. While the Zig Zag indicator doesn't forecast future trends, it helps identify possible support and resistance levels between the plotted swing highs and lows.
 *
 * @see https://www.investopedia.com/ask/answers/030415/what-zig-zag-indicator-formula-and-how-it-calculated.asp
 * @see https://www.investopedia.com/terms/z/zig_zag_indicator.asp
 * @see https://www.tradingview.com/u/?solution=43000591664
 * @see https://capex.com/en/academy/zigzag
 * @see https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/zig-zag-indicator/
 */
export class ZigZag extends BigIndicatorSeries<HighLow> {
  private readonly percentageThreshold: Big;
  private lastExtremeValue: Big | null = null;
  private lastExtremeType: 'high' | 'low' | null = null;
  private currentExtremeValue: Big | null = null;
  private currentExtremeType: 'high' | 'low' | null = null;

  // Cache for replace functionality
  private previousLastExtremeValue: Big | null = null;
  private previousLastExtremeType: 'high' | 'low' | null = null;
  private previousCurrentExtremeValue: Big | null = null;
  private previousCurrentExtremeType: 'high' | 'low' | null = null;

  constructor(config: ZigZagConfig) {
    super();

    // Convert the percentage to a decimal (e.g., 5% becomes 0.05)
    this.percentageThreshold = new Big(config.deviation).div(100);

    if (this.percentageThreshold.lte(0)) {
      throw new Error('Percentage threshold must be greater than 0');
    }
  }

  override getRequiredInputs(): number {
    return 2;
  }

  override get isStable(): boolean {
    return this.lastExtremeValue !== null;
  }

  update(candle: HighLow, replace: boolean): Big | null {
    const high = new Big(candle.high);
    const low = new Big(candle.low);

    // Handle replace flag - restore previous state if replacing
    if (replace) {
      this.lastExtremeValue = this.previousLastExtremeValue;
      this.lastExtremeType = this.previousLastExtremeType;
      this.currentExtremeValue = this.previousCurrentExtremeValue;
      this.currentExtremeType = this.previousCurrentExtremeType;
    } else {
      // Cache current state for potential replacement
      this.previousLastExtremeValue = this.lastExtremeValue;
      this.previousLastExtremeType = this.lastExtremeType;
      this.previousCurrentExtremeValue = this.currentExtremeValue;
      this.previousCurrentExtremeType = this.currentExtremeType;
    }

    // If not enough previous data is available
    if (!this.lastExtremeValue) {
      // If this is our first candle, just record the high as the initial extreme point
      if (!this.currentExtremeValue) {
        this.currentExtremeValue = high;
        this.currentExtremeType = 'high';
        return null;
      }

      // If this is our second candle, determine the initial swing
      if (high.gt(this.currentExtremeValue)) {
        // Check if this is a replace operation with a significant change
        if (replace) {
          const percentChange = this.calculatePercentChange(this.currentExtremeValue, high);
          if (percentChange.gte(this.percentageThreshold)) {
            // Significant change during replace, treat new high as confirmed point
            return this.setResult(high, replace);
          }
        }
        // New high, keep it as the current extreme
        this.currentExtremeValue = high;
        this.currentExtremeType = 'high';
        return null;
      } else if (low.lt(this.currentExtremeValue)) {
        // The price made a lower low, potentially establish a new swing low
        const percentChange = this.calculatePercentChange(this.currentExtremeValue, low);

        if (percentChange.gte(this.percentageThreshold)) {
          // Percentage change is significant, confirm the high as last extreme
          this.lastExtremeValue = this.currentExtremeValue;
          this.lastExtremeType = this.currentExtremeType;

          // Start tracking a new potential low
          this.currentExtremeValue = low;
          this.currentExtremeType = 'low';

          return this.setResult(this.lastExtremeValue, replace);
        }
      }

      return null;
    }

    // Based on the last extreme type, process the new candle
    if (this.lastExtremeType === 'high') {
      // We're looking for a significant low
      if (this.currentExtremeValue && low.lt(this.currentExtremeValue)) {
        // New potential extreme low
        this.currentExtremeValue = low;
        this.currentExtremeType = 'low';
      } else if (high.gt(this.lastExtremeValue)) {
        // We've moved higher than the last high without confirming a low
        // This invalidates our current swing, so adjust accordingly
        this.currentExtremeValue = high;
        this.currentExtremeType = 'high';
        this.lastExtremeValue = this.currentExtremeValue;
        this.lastExtremeType = this.currentExtremeType;

        return this.setResult(this.lastExtremeValue, replace);
      }

      // Check if the swing from high to low is significant
      if (this.lastExtremeValue && this.currentExtremeValue) {
        const percentChange = this.calculatePercentChange(this.lastExtremeValue, this.currentExtremeValue);

        if (percentChange.gte(this.percentageThreshold)) {
          // Confirm the current low as a significant point
          const previousExtreme = this.lastExtremeValue;
          this.lastExtremeValue = this.currentExtremeValue;
          this.lastExtremeType = this.currentExtremeType;

          // Start looking for a new high
          this.currentExtremeValue = high;
          this.currentExtremeType = 'high';

          return this.setResult(previousExtreme, replace);
        }
      }
    } else if (this.lastExtremeType === 'low') {
      // We're looking for a significant high
      if (this.currentExtremeValue && high.gt(this.currentExtremeValue)) {
        // New potential extreme high
        this.currentExtremeValue = high;
        this.currentExtremeType = 'high';
      } else if (low.lt(this.lastExtremeValue)) {
        // We've moved lower than the last low without confirming a high
        // This invalidates our current swing, so adjust accordingly
        this.currentExtremeValue = low;
        this.currentExtremeType = 'low';
        this.lastExtremeValue = this.currentExtremeValue;
        this.lastExtremeType = this.currentExtremeType;

        return this.setResult(this.lastExtremeValue, replace);
      }

      // Check if the swing from low to high is significant
      if (this.lastExtremeValue && this.currentExtremeValue) {
        const percentChange = this.calculatePercentChange(this.lastExtremeValue, this.currentExtremeValue);

        if (percentChange.gte(this.percentageThreshold)) {
          // Confirm the current high as a significant point
          const previousExtreme = this.lastExtremeValue;
          this.lastExtremeValue = this.currentExtremeValue;
          this.lastExtremeType = this.currentExtremeType;

          // Start looking for a new low
          this.currentExtremeValue = low;
          this.currentExtremeType = 'low';

          return this.setResult(previousExtreme, replace);
        }
      }
    }

    // If we reach here, no significant change has occurred
    return this.setResult(this.lastExtremeValue, replace);
  }

  private calculatePercentChange(from: Big, to: Big): Big {
    // Calculate absolute percentage change: |to - from| / from * 100
    return from.eq(0) ? new Big(0) : to.minus(from).abs().div(from);
  }

  override getResultOrThrow(): Big {
    if (this.lastExtremeValue === null) {
      throw new NotEnoughDataError(this.getRequiredInputs());
    }

    return super.getResultOrThrow();
  }
}

export class FasterZigZag extends NumberIndicatorSeries<HighLow<number>> {
  private readonly percentageThreshold: number;
  private lastExtreme: number | null = null;
  private lastExtremeType: 'high' | 'low' | null = null;
  private currentExtreme: number | null = null;
  private currentExtremeType: 'high' | 'low' | null = null;

  // Cache for replace functionality
  private previousLastExtreme: number | null = null;
  private previousLastExtremeType: 'high' | 'low' | null = null;
  private previousCurrentExtreme: number | null = null;
  private previousCurrentExtremeType: 'high' | 'low' | null = null;

  constructor(config: ZigZagConfig) {
    super();

    // Convert the percentage to a decimal (e.g., 5% becomes 0.05)
    this.percentageThreshold = config.deviation / 100;

    if (this.percentageThreshold <= 0) {
      throw new Error('Percentage threshold must be greater than 0');
    }
  }

  override getRequiredInputs(): number {
    return 2;
  }

  override get isStable(): boolean {
    return this.lastExtreme !== null;
  }

  update(candle: HighLow<number>, replace: boolean): number | null {
    const {high, low} = candle;

    // Handle replace flag - restore previous state if replacing
    if (replace) {
      this.lastExtreme = this.previousLastExtreme;
      this.lastExtremeType = this.previousLastExtremeType;
      this.currentExtreme = this.previousCurrentExtreme;
      this.currentExtremeType = this.previousCurrentExtremeType;
    } else {
      // Cache current state for potential replacement
      this.previousLastExtreme = this.lastExtreme;
      this.previousLastExtremeType = this.lastExtremeType;
      this.previousCurrentExtreme = this.currentExtreme;
      this.previousCurrentExtremeType = this.currentExtremeType;
    }

    // If not enough previous data is available
    if (!this.lastExtreme) {
      // If this is our first candle, just record the high as the initial extreme point
      if (!this.currentExtreme) {
        this.currentExtreme = high;
        this.currentExtremeType = 'high';
        return null;
      }

      // If this is our second candle, determine the initial swing
      if (high > this.currentExtreme) {
        // New high, keep it as the current extreme
        this.currentExtreme = high;
        this.currentExtremeType = 'high';
        return null;
      } else if (low < this.currentExtreme) {
        // The price made a lower low, potentially establish a new swing low
        const percentChange = this.calculatePercentChange(this.currentExtreme, low);

        if (percentChange >= this.percentageThreshold) {
          // Percentage change is significant, confirm the high as last extreme
          this.lastExtreme = this.currentExtreme;
          this.lastExtremeType = this.currentExtremeType;

          // Start tracking a new potential low
          this.currentExtreme = low;
          this.currentExtremeType = 'low';

          return this.setResult(this.lastExtreme, replace);
        }
      }

      return null;
    }

    // Based on the last extreme type, process the new candle
    if (this.lastExtremeType === 'high') {
      // We're looking for a significant low
      if (this.currentExtreme && low < this.currentExtreme) {
        // New potential extreme low
        this.currentExtreme = low;
        this.currentExtremeType = 'low';
      } else if (high > this.lastExtreme) {
        // We've moved higher than the last high without confirming a low
        // This invalidates our current swing, so adjust accordingly
        this.currentExtreme = high;
        this.currentExtremeType = 'high';
        this.lastExtreme = this.currentExtreme;
        this.lastExtremeType = this.currentExtremeType;

        return this.setResult(this.lastExtreme, replace);
      }

      // Check if the swing from high to low is significant
      if (this.lastExtreme !== null && this.currentExtreme !== null) {
        const percentChange = this.calculatePercentChange(this.lastExtreme, this.currentExtreme);

        if (percentChange >= this.percentageThreshold) {
          // Confirm the current low as a significant point
          const previousExtreme = this.lastExtreme;
          this.lastExtreme = this.currentExtreme;
          this.lastExtremeType = this.currentExtremeType;

          // Start looking for a new high
          this.currentExtreme = high;
          this.currentExtremeType = 'high';

          return this.setResult(previousExtreme, replace);
        }
      }
    } else if (this.lastExtremeType === 'low') {
      // We're looking for a significant high
      if (this.currentExtreme && high > this.currentExtreme) {
        // New potential extreme high
        this.currentExtreme = high;
        this.currentExtremeType = 'high';
      } else if (low < this.lastExtreme) {
        // We've moved lower than the last low without confirming a high
        // This invalidates our current swing, so adjust accordingly
        this.currentExtreme = low;
        this.currentExtremeType = 'low';
        this.lastExtreme = this.currentExtreme;
        this.lastExtremeType = this.currentExtremeType;

        return this.setResult(this.lastExtreme, replace);
      }

      // Check if the swing from low to high is significant
      if (this.lastExtreme !== null && this.currentExtreme !== null) {
        const percentChange = this.calculatePercentChange(this.lastExtreme, this.currentExtreme);

        if (percentChange >= this.percentageThreshold) {
          // Confirm the current high as a significant point
          const previousExtreme = this.lastExtreme;
          this.lastExtreme = this.currentExtreme;
          this.lastExtremeType = this.currentExtremeType;

          // Start looking for a new low
          this.currentExtreme = low;
          this.currentExtremeType = 'low';

          return this.setResult(previousExtreme, replace);
        }
      }
    }

    // If we reach here, no significant change has occurred
    return this.setResult(this.lastExtreme, replace);
  }

  private calculatePercentChange(from: number, to: number): number {
    // Calculate absolute percentage change: |to - from| / from
    return from === 0 ? 0 : Math.abs(to - from) / from;
  }

  override getResultOrThrow(): number {
    if (this.lastExtreme === null) {
      throw new NotEnoughDataError(this.getRequiredInputs());
    }

    return super.getResultOrThrow();
  }
}
