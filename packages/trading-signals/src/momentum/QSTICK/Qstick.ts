import type {OpenHighLowClose} from '../../base/Candle.type.js';
import {IndicatorInputShape, ZeroCrossSeries} from '../../base/Indicator.js';
import {SMA} from '../../trend/SMA/SMA.js';

/**
 * Qstick
 * Type: Momentum
 *
 * Developed by Tushar Chande, Qstick averages the candle bodies (close minus open) of the last
 * candles to expose buying or selling pressure that a price chart hides: a market can drift
 * higher through opening gaps while sellers dominate every session. A positive reading means
 * buyers close candles above their opens, a negative reading means sellers pin closes below
 * the opens. Chande suggests an interval of 8 periods.
 *
 * Interpretation:
 * A Qstick above zero signals bullish pressure, below zero bearish pressure. A crossing of the
 * zero line marks the moment control shifts from one side to the other. A window of dojis
 * closing exactly where they opened is perfectly balanced (zero).
 *
 * @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/indicators/qstick.c
 * @see https://www.investopedia.com/terms/q/qstick.asp
 */
export class Qstick extends ZeroCrossSeries<OpenHighLowClose> {
  override readonly inputShape = IndicatorInputShape.OPEN_HIGH_LOW_CLOSE;

  readonly #sma: SMA;

  public readonly interval: number;

  constructor(interval: number = 8) {
    super();
    this.interval = interval;
    this.#sma = new SMA(interval);
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update({close, open}: OpenHighLowClose, replace: boolean) {
    const smaResult = this.#sma.update(close - open, replace);

    if (smaResult === null) {
      return null;
    }

    return this.setResult(smaResult, replace);
  }
}
