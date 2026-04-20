import type {HighLowCloseVolume} from '../../types/HighLowClose.js';
import {TradingSignal, TrendIndicatorSeries} from '../../types/Indicator.js';
import type {MovingAverage} from '../../trend/MA/MovingAverage.js';
import type {MovingAverageTypes} from '../../trend/MA/MovingAverageTypes.js';
import {SMA} from '../../trend/SMA/SMA.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Volume Weighted Moving Average (VWMA)
 * Type: Volume
 *
 * The Volume Weighted Moving Average (VWMA) is similar to SMA but weights each price by its corresponding volume.
 * When volume is relatively even across periods, VWMA behaves like a simple moving average. When volume spikes on
 * certain bars, those bars have more influence on the average.
 *
 * A signal line (default SMA) is used to generate trading signals. When the VWMA crosses above the signal line,
 * it indicates bullish momentum. When it crosses below, it indicates bearish momentum.
 *
 * Formula:
 * VWMA = Sum(Close * Volume, n) / Sum(Volume, n)
 *
 * @see https://www.investopedia.com/articles/trading/11/trading-with-vwap-mvwap.asp
 */
export class VWMA extends TrendIndicatorSeries<HighLowCloseVolume> {
  readonly #candles: HighLowCloseVolume[] = [];
  readonly #signalLine: MovingAverage;

  public readonly interval: number;

  constructor(interval: number, SignalIndicator: MovingAverageTypes = SMA, signalInterval: number = interval) {
    super();
    this.interval = interval;
    this.#signalLine = new SignalIndicator(signalInterval);
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(candle: HighLowCloseVolume, replace: boolean) {
    pushUpdate(this.#candles, replace, candle, this.interval);

    if (this.#candles.length < this.interval) {
      return null;
    }

    let sumPriceVolume = 0;
    let sumVolume = 0;

    for (const c of this.#candles) {
      sumPriceVolume += c.close * c.volume;
      sumVolume += c.volume;
    }

    if (sumVolume === 0) {
      return null;
    }

    const vwma = sumPriceVolume / sumVolume;
    this.#signalLine.update(vwma, replace);

    return this.setResult(vwma, replace);
  }

  protected calculateSignalState(result: number | null | undefined) {
    if (result === null || result === undefined) {
      return TradingSignal.UNKNOWN;
    }

    const signalValue = this.#signalLine.getResult();

    if (signalValue === null) {
      return TradingSignal.SIDEWAYS;
    }

    if (result > signalValue) {
      return TradingSignal.BULLISH;
    }

    if (result < signalValue) {
      return TradingSignal.BEARISH;
    }

    return TradingSignal.SIDEWAYS;
  }
}
