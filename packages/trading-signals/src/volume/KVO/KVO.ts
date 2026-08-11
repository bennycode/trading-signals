import type {HighLowCloseVolume} from '../../base/Candle.type.js';
import {ZeroCrossSeries} from '../../base/Indicator.js';

type KVOState = {
  /**
   * Klinger's "cumulative measurement": the running sum of candle ranges within the current swing.
   * The wider it grows, the smaller a single candle's share of the swing becomes.
   */
  cumulativeMeasurement: number;
  emas: {
    long: number;
    short: number;
  } | null;
  previousCandle: {
    hlcSum: number;
    range: number;
  } | null;
  trend: -1 | 0 | 1;
};

const createInitialState = (): KVOState => ({
  cumulativeMeasurement: 0,
  emas: null,
  previousCandle: null,
  trend: 0,
});

/**
 * Klinger Volume Oscillator (KVO)
 * Type: Volume
 *
 * Stephen Klinger's oscillator turns each candle's volume into a signed "volume force": the full volume counts as
 * buying or selling pressure depending on the running trend of the high/low/close sum, scaled by how one-sided the
 * candle's range sits within the current swing. The oscillator is the spread between a short and a long EMA of that
 * force, built to catch money-flow reversals early while staying anchored to the longer-term flow.
 *
 * Interpretation: A reading above zero signals bullish volume pressure, below zero bearish pressure. Zero-line
 * crossings mark a change in the dominant money flow, and divergence between the oscillator and price warns that the
 * current move is running out of volume support.
 *
 * @see https://www.investopedia.com/terms/k/klingeroscillator.asp
 * @see https://tulipindicators.org/kvo
 */
export class KVO extends ZeroCrossSeries<HighLowCloseVolume> {
  public readonly shortInterval: number;
  public readonly longInterval: number;
  readonly #shortSmoothing: number;
  readonly #longSmoothing: number;
  #state: KVOState = createInitialState();
  #previousState: KVOState = createInitialState();

  constructor(shortInterval: number = 34, longInterval: number = 55) {
    super();
    this.shortInterval = shortInterval;
    this.longInterval = longInterval;
    this.#shortSmoothing = 2 / (shortInterval + 1);
    this.#longSmoothing = 2 / (longInterval + 1);
  }

  /**
   * One candle of history is all Klinger needs: the first volume-force reading appears with the second candle and
   * seeds both averages outright (mirroring the Tulip Indicators reference), so every emitted value is already final
   * and more history never revises it. The smoothing intervals therefore add no further warm-up.
   */
  override getRequiredInputs() {
    return 2;
  }

  update(candle: HighLowCloseVolume, replace: boolean) {
    /*
     * The trend direction, the cumulative measurement and both averages accumulate over the entire series, so a
     * replacement has to restart from the state that existed before the replaced candle arrived.
     */
    if (replace) {
      this.#state = structuredClone(this.#previousState);
    } else {
      this.#previousState = structuredClone(this.#state);
    }

    const state = this.#state;
    const hlcSum = candle.high + candle.low + candle.close;
    const range = candle.high - candle.low;
    const previousCandle = state.previousCandle;

    state.previousCandle = {hlcSum, range};

    if (previousCandle === null) {
      return null;
    }

    /*
     * Klinger reads the market's push from the sum of high, low and close: higher sums keep the swing up, lower sums
     * turn it down. Every flip restarts the cumulative measurement from the previous candle's range.
     */
    if (hlcSum > previousCandle.hlcSum && state.trend !== 1) {
      state.trend = 1;
      state.cumulativeMeasurement = previousCandle.range;
    } else if (hlcSum < previousCandle.hlcSum && state.trend !== -1) {
      state.trend = -1;
      state.cumulativeMeasurement = previousCandle.range;
    }

    state.cumulativeMeasurement += range;

    // Until the first flip (only possible while consecutive sums tie), volume counts as buying pressure, matching the reference implementation.
    const direction = state.trend === -1 ? -1 : 1;

    /*
     * A market that has never traded a range offers no swing to attribute volume to, so its volume force is zero.
     * This deliberately deviates from the Tulip reference, which divides by the empty measurement and poisons every
     * later reading — a streaming indicator could never recover from that.
     */
    const volumeForce =
      state.cumulativeMeasurement === 0
        ? 0
        : candle.volume * Math.abs((range / state.cumulativeMeasurement) * 2 - 1) * 100 * direction;

    const emas =
      state.emas === null
        ? {long: volumeForce, short: volumeForce}
        : {
            long: (volumeForce - state.emas.long) * this.#longSmoothing + state.emas.long,
            short: (volumeForce - state.emas.short) * this.#shortSmoothing + state.emas.short,
          };

    state.emas = emas;

    return this.setResult(emas.short - emas.long, replace);
  }
}
