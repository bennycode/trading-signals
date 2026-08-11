import {TechnicalIndicator} from '../../base/Indicator.js';
import type {HighLowClose} from '../../base/Candle.type.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {ATR} from '../ATR/ATR.js';

export type KeltnerChannelsResult = {
  lower: number;
  middle: number;
  upper: number;
};

export type KeltnerChannelsConfig = {
  /** Number of candles for the Average True Range that sets the channel width (default: 10) */
  atrInterval?: number;
  /** Number of candles for the Exponential Moving Average that forms the middle line (default: 20) */
  emaInterval?: number;
  /** How many ATRs the upper and lower channel lines sit away from the middle line (default: 2) */
  multiplier?: number;
};

/**
 * Keltner Channels (KC)
 * Type: Volatility
 *
 * Keltner Channels wrap a volatility-scaled envelope around an Exponential Moving Average: the
 * channel width follows the Average True Range, so the channels breathe with the market — widening
 * in turbulent phases and tightening in quiet ones. Unlike Bollinger Bands, whose width comes from
 * the standard deviation of closing prices, the ATR-based width also picks up gaps and intraday
 * swings, which makes the channels a smoother, trend-friendlier envelope.
 *
 * Chester Keltner's original 1960 version placed a Simple Moving Average of the typical price
 * inside bands derived from the high-low range. This implementation follows the modern definition
 * popularized by Linda Bradford Raschke: an EMA middle line with ATR-based channel lines.
 *
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:keltner_channels
 * @see https://www.investopedia.com/terms/k/keltnerchannel.asp
 */
export class KeltnerChannels extends TechnicalIndicator<KeltnerChannelsResult, HighLowClose<number>> {
  readonly #middle: EMA;
  readonly #atr: ATR;

  public readonly atrInterval: number;
  public readonly emaInterval: number;
  public readonly multiplier: number;

  constructor({atrInterval = 10, emaInterval = 20, multiplier = 2}: KeltnerChannelsConfig = {}) {
    super();
    this.atrInterval = atrInterval;
    this.emaInterval = emaInterval;
    this.multiplier = multiplier;
    this.#middle = new EMA(emaInterval);
    this.#atr = new ATR(atrInterval);
  }

  override getRequiredInputs() {
    return Math.max(this.#middle.getRequiredInputs(), this.#atr.getRequiredInputs());
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    this.#middle.update(candle.close, replace);
    this.#atr.update(candle, replace);

    if (this.#middle.isStable && this.#atr.isStable) {
      const middle = this.#middle.getResultOrThrow();
      const channelOffset = this.multiplier * this.#atr.getResultOrThrow();

      return (this.result = {
        lower: middle - channelOffset,
        middle,
        upper: middle + channelOffset,
      });
    }

    return null;
  }
}
