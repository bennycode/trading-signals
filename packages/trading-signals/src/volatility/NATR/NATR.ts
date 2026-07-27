import type {HighLowClose} from '../../base/Candle.type.js';
import {IndicatorSeries} from '../../base/Indicator.js';
import type {MovingAverageTypes} from '../../trend/MA/MovingAverageTypes.js';
import {WSMA} from '../../trend/WSMA/WSMA.js';
import {ATR} from '../ATR/ATR.js';

/**
 * Normalized Average True Range (NATR)
 * Type: Volatility
 *
 * Makes volatility comparable across instruments: a raw $5 ATR means nothing without the price level — it's huge for
 * a $50 stock and noise for a $5,000 one. The NATR expresses the ATR as a percentage of the closing price, so
 * readings compare directly between differently priced assets and across long time ranges of the same asset.
 *
 * @see https://www.investopedia.com/terms/a/atr.asp
 * @see https://tulipindicators.org/natr
 */
export class NATR extends IndicatorSeries<HighLowClose<number>> {
  readonly #atr: ATR;

  public readonly interval: number;

  constructor(interval: number, SmoothingIndicator: MovingAverageTypes = WSMA) {
    super();
    this.interval = interval;
    this.#atr = new ATR(interval, SmoothingIndicator);
  }

  override getRequiredInputs() {
    return this.#atr.getRequiredInputs();
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    const atr = this.#atr.update(candle, replace);

    if (atr === null) {
      return null;
    }

    return this.setResult((100 * atr) / candle.close, replace);
  }
}
