import type {HighLow} from '../../base/Candle.type.js';
import {IndicatorInputShape, TechnicalIndicator} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

export type IchimokuCloudResult = {
  /** Kijun-sen: equilibrium of the medium-term trading range */
  base: number;
  /** Tenkan-sen: equilibrium of the short-term trading range */
  conversion: number;
  /** Senkou Span A: midpoint between conversion and base line, the faster cloud boundary */
  spanA: number;
  /** Senkou Span B: equilibrium of the long-term trading range, the slower cloud boundary */
  spanB: number;
};

export type IchimokuCloudConfig = {
  /** Window of the Kijun-sen base line (default: 26) */
  baseInterval?: number;
  /** Window of the Tenkan-sen conversion line (default: 9) */
  conversionInterval?: number;
  /** Window of the Senkou Span B line (default: 52) */
  spanBInterval?: number;
};

/**
 * Ichimoku Cloud (ICHIMOKU)
 * Type: Trend
 *
 * The Ichimoku Cloud (Ichimoku Kinko Hyo, "one-glance equilibrium chart") was developed by the Japanese journalist
 * Goichi Hosoda and published in 1969. Every line is the midpoint between the highest high and the lowest low of its
 * window, so each line marks the equilibrium of a trading range: the fast conversion line (Tenkan-sen) tracks short
 * swings, the slower base line (Kijun-sen) anchors the medium-term range, and the two leading spans (Senkou Span A/B)
 * enclose the cloud (Kumo) that traders read as support and resistance.
 *
 * On a chart, both spans are plotted 26 bars ahead of the current bar and the lagging span (Chikou) 26 bars behind
 * it. This implementation returns the values as computed at the current bar and leaves the plotting displacement to
 * the consumer, which is the convention streaming libraries use. The lagging span is omitted entirely because
 * undisplaced it is just the current close.
 *
 * @see https://www.investopedia.com/terms/i/ichimoku-cloud.asp
 * @see https://en.wikipedia.org/wiki/Ichimoku_Kink%C5%8D_Hy%C5%8D
 */
export class IchimokuCloud extends TechnicalIndicator<IchimokuCloudResult, HighLow<number>> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW;

  readonly #candles: HighLow<number>[] = [];
  public readonly baseInterval: number;
  public readonly conversionInterval: number;
  public readonly spanBInterval: number;

  constructor({baseInterval = 26, conversionInterval = 9, spanBInterval = 52}: IchimokuCloudConfig = {}) {
    super();
    this.baseInterval = baseInterval;
    this.conversionInterval = conversionInterval;
    this.spanBInterval = spanBInterval;
  }

  override getRequiredInputs() {
    return Math.max(this.baseInterval, this.conversionInterval, this.spanBInterval);
  }

  // Hosoda's equilibrium: the middle of the range traded over the window, in a single pass to keep the hot path allocation-free
  #getMidpoint(interval: number) {
    const start = this.#candles.length - interval;
    let highestHigh = this.#candles[start].high;
    let lowestLow = this.#candles[start].low;

    for (let i = start + 1; i < this.#candles.length; i++) {
      const {high, low} = this.#candles[i];
      highestHigh = Math.max(highestHigh, high);
      lowestLow = Math.min(lowestLow, low);
    }

    return (highestHigh + lowestLow) / 2;
  }

  update(candle: HighLow<number>, replace: boolean) {
    pushUpdate({array: this.#candles, item: candle, maxLength: this.getRequiredInputs(), replace: replace});

    if (this.#candles.length < this.getRequiredInputs()) {
      return null;
    }

    const conversion = this.#getMidpoint(this.conversionInterval);
    const base = this.#getMidpoint(this.baseInterval);

    return (this.result = {
      base,
      conversion,
      spanA: (conversion + base) / 2,
      spanB: this.#getMidpoint(this.spanBInterval),
    });
  }
}
