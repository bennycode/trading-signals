import {IndicatorSeries} from '../../base/Indicator.js';
import type {HighLow} from '../../base/Candle.type.js';

export type ZigZagConfig = {
  /**
   * The percentage change required to establish a new extreme point.
   * Typical values range from 3 to 12 (representing 3% to 12%).
   */
  deviation: number;
};

/**
 * The swing state {@link ZigZag.update} carries between candles. Held in the base-class state
 * container so a replacement re-runs the latest candle from the state that candle originally saw.
 */
type ZigZagState = {
  highestExtreme: number | null;
  isUp: boolean;
  /**
   * Whether the latest candle reversed the trend. ZigZag emits only on a reversal and its result
   * persists in between, so only a candle that emitted may withdraw that pivot when replaced.
   */
  lastCandleReversedTrend: boolean;
  lowestExtreme: number | null;
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
export class ZigZag extends IndicatorSeries<HighLow, ZigZagState> {
  readonly #deviation: number;
  protected override state: ZigZagState = {
    highestExtreme: null,
    isUp: false,
    lastCandleReversedTrend: false,
    lowestExtreme: null,
  };

  constructor(config: ZigZagConfig) {
    super();
    this.#deviation = config.deviation;
  }

  override getRequiredInputs() {
    return 1;
  }

  update(candle: HighLow<number>, replace: boolean): number | null {
    const low = candle.low;
    const high = candle.high;

    // Read before trackState() rewinds the flag to what the candle before the replaced one found
    if (replace && this.state.lastCandleReversedTrend) {
      this.rollbackLastResult();
    }

    this.trackState(replace);

    const state = this.state;

    state.lastCandleReversedTrend = false;

    if (state.lowestExtreme === null) {
      state.lowestExtreme = low;
    }

    if (state.highestExtreme === null) {
      state.highestExtreme = high;
    }

    if (state.isUp) {
      const uptrendReversal =
        state.lowestExtreme + ((state.highestExtreme - state.lowestExtreme) * (100 - this.#deviation)) / 100;

      if (high > state.highestExtreme) {
        state.highestExtreme = high;
      } else if (low < uptrendReversal) {
        state.isUp = false;
        state.lowestExtreme = low;
        state.lastCandleReversedTrend = true;
        return this.setResult(state.highestExtreme, replace);
      }
    } else {
      const downtrendReversal = low + ((state.highestExtreme - low) * this.#deviation) / 100;

      if (low < state.lowestExtreme) {
        state.lowestExtreme = low;
      } else if (high > downtrendReversal) {
        state.isUp = true;
        state.highestExtreme = high;
        state.lastCandleReversedTrend = true;
        return this.setResult(state.lowestExtreme, replace);
      }
    }

    return null;
  }
}
