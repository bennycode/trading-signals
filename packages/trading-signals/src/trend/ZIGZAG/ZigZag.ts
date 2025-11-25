import {IndicatorSeries} from '../../types/Indicator.js';
import type {HighLow} from '../../types/HighLowClose.js';

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
 * The ZigZag indicator is a technical analysis tool used to identify price trends by filtering out smaller price movements. It works by identifying significant highs and lows in a price series and drawing lines between them. For a high or low to be considered significant, the price must reverse by at least a specified percentage (deviation) from the last extreme point.
 *
 * The indicator alternates between tracking highs and lows: after confirming a high, it searches for a significant low, and after confirming a low, it searches for a significant high.
 *
 * The Zig Zag indicator is considered to be a very lagging indicator because its values are plotted only after each time period closes, and it only forms a permanent new line once the price has moved significantly. Traders can use popular technical indicators like RSI, ADX, and the Stochastics oscillator to confirm the price of a security is overbought or oversold when the ZigZag line changes direction.
 *
 * @see https://www.investopedia.com/ask/answers/030415/what-zig-zag-indicator-formula-and-how-it-calculated.asp
 * @see https://www.investopedia.com/terms/z/zig_zag_indicator.asp
 * @see https://capex.com/en/academy/zigzag
 * @see https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/zig-zag-indicator/
 */
export class ZigZag extends IndicatorSeries<HighLow> {
  private readonly deviation: number;
  private isUp: boolean = false;
  private highestExtreme: number | null = null;
  private lowestExtreme: number | null = null;

  constructor(config: ZigZagConfig) {
    super();
    this.deviation = config.deviation;
  }

  override getRequiredInputs(): number {
    return 1;
  }

  update(candle: HighLow<number>, replace: boolean): number | null {
    const low = candle.low;
    const high = candle.high;

    if (this.lowestExtreme === null) {
      this.lowestExtreme = low;
    }

    if (this.highestExtreme === null) {
      this.highestExtreme = high;
    }

    if (this.isUp) {
      const uptrendReversal =
        this.lowestExtreme + ((this.highestExtreme - this.lowestExtreme) * (100 - this.deviation)) / 100;

      if (high > this.highestExtreme) {
        this.highestExtreme = high;
      } else if (low < uptrendReversal) {
        this.isUp = false;
        this.lowestExtreme = low;
        return this.setResult(this.highestExtreme, replace);
      }
    } else {
      const downtrendReversal = low + ((this.highestExtreme - low) * this.deviation) / 100;

      if (low < this.lowestExtreme) {
        this.lowestExtreme = low;
      } else if (high > downtrendReversal) {
        this.isUp = true;
        this.highestExtreme = high;
        return this.setResult(this.lowestExtreme, replace);
      }
    }

    return null;
  }
}
