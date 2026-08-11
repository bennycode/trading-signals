import {EMA} from '../../trend/EMA/EMA.js';
import {SMA} from '../../trend/SMA/SMA.js';
import type {HighLowClose} from '../../base/Candle.type.js';
import {TechnicalIndicator, TradingSignal} from '../../base/Indicator.js';

export type WaveTrendResult = {
  /** Fast wave line (WT1) */
  wt1: number;
  /** Trigger line (WT2) trailing the fast wave line */
  wt2: number;
};

export type WaveTrendConfig = {
  /** Number of readings smoothing the normalized channel stretch into the fast wave line ("Average Length") */
  averageInterval?: number;
  /** Number of candles forming the smoothed price channel the average price is measured against ("Channel Length") */
  channelInterval?: number;
  /** Number of fast wave line readings averaged into the trigger line */
  smoothingInterval?: number;
};

/**
 * WaveTrend (WT)
 * Type: Momentum
 *
 * The WaveTrend Oscillator was published by the TradingView author LazyBear in 2014 and has become a popular momentum
 * gauge on crypto dashboards. It measures how far the average price (HLC3) has stretched away from an exponentially
 * smoothed channel of itself, normalizes that stretch by the average absolute deviation (scaled by the CCI constant
 * 0.015 so that regular trading lands roughly inside ±100), and smooths the readings into a fast wave line (WT1) and
 * a trailing trigger line (WT2).
 *
 * Interpretation: WT1 trading above the trigger line signals bullish momentum, below it bearish momentum. Readings
 * beyond ±53 mark the overbought/oversold bands and beyond ±60 extreme levels; a cross of the two lines inside those
 * bands is the classic WaveTrend entry.
 *
 * @see https://www.tradingview.com/script/2KE8wTuF-Indicator-WaveTrend-Oscillator-WT/
 * @see https://medium.com/@samuel.mcculloch/lets-take-a-look-at-wavetrend-with-crosses-lazybear-s-indicator-2ece1737f72f
 */
export class WaveTrend extends TechnicalIndicator<WaveTrendResult, HighLowClose<number>> {
  public readonly averageInterval: number;
  public readonly channelInterval: number;
  public readonly smoothingInterval: number;
  readonly #channel: EMA;
  readonly #deviation: EMA;
  readonly #wave: EMA;
  readonly #trigger: SMA;
  #previousResult?: WaveTrendResult;

  constructor({averageInterval = 21, channelInterval = 10, smoothingInterval = 4}: WaveTrendConfig = {}) {
    super();
    this.averageInterval = averageInterval;
    this.channelInterval = channelInterval;
    this.smoothingInterval = smoothingInterval;
    this.#channel = new EMA(channelInterval);
    this.#deviation = new EMA(channelInterval);
    this.#wave = new EMA(averageInterval);
    this.#trigger = new SMA(smoothingInterval);
  }

  override getRequiredInputs() {
    return Math.max(this.averageInterval, this.channelInterval, this.smoothingInterval);
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const averagePrice = (candle.high + candle.low + candle.close) / 3;
    const channel = this.#channel.update(averagePrice, replace);
    const deviation = this.#deviation.update(Math.abs(averagePrice - channel), replace);

    /*
     * A market glued to its channel has no deviation to normalize by. Reporting zero stretch keeps
     * a dead market neutral instead of fabricating momentum from a division by zero.
     */
    const channelIndex = deviation === 0 ? 0 : (averagePrice - channel) / (0.015 * deviation);
    const wt1 = this.#wave.update(channelIndex, replace);
    const wt2 = this.#trigger.update(wt1, replace);

    if (wt2 === null || !this.#wave.isStable || !this.#channel.isStable) {
      return null;
    }

    if (replace) {
      this.result = this.#previousResult;
    }

    this.#previousResult = this.result;

    return (this.result = {wt1, wt2});
  }

  protected calculateSignal(result?: WaveTrendResult | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isBullish = hasResult && result.wt1 > result.wt2;
    const isBearish = hasResult && result.wt1 < result.wt2;

    switch (true) {
      case !hasResult:
        return TradingSignal.UNKNOWN;
      case isBullish:
        return TradingSignal.BULLISH;
      case isBearish:
        return TradingSignal.BEARISH;
      default:
        return TradingSignal.SIDEWAYS;
    }
  }

  getSignal(): {
    state: (typeof TradingSignal)[keyof typeof TradingSignal];
    hasChanged: boolean;
  } {
    const previousState = this.calculateSignal(this.#previousResult);
    const state = this.calculateSignal(this.getResult());
    const hasChanged = previousState !== state;

    return {
      hasChanged,
      state,
    };
  }
}
