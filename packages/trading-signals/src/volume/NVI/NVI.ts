import type {HighLowCloseVolume} from '../../base/Candle.type.js';
import {IndicatorInputShape, TradingSignal, type TradingSignals, TrendIndicatorSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';

type NVIState = {
  nvi: number;
  previousCandle: HighLowCloseVolume | null;
};

/**
 * Negative Volume Index (NVI)
 * Type: Volume
 *
 * Developed by Paul Dysart in the 1930s and popularized by Norman Fosback in "Stock Market Logic" (1976), the
 * Negative Volume Index follows price changes only on days when trading volume declines. The premise is that the
 * uninformed crowd dominates the busy days while "smart money" positions itself quietly on falling-volume days, so a
 * rising NVI reflects informed accumulation.
 *
 * Formula:
 * The index starts at 1000. When a bar's volume falls below the previous bar's volume, the index changes by the
 * closing price's percentage change. On rising or unchanged volume, the index stays flat.
 *
 * Interpretation:
 * The NVI carries no fixed threshold. Fosback read it against its own one-year moving average: an NVI above that
 * average historically indicated high odds of a bull market. The signal follows that reading, against an EMA of the
 * index that is one year of daily bars long unless configured otherwise.
 *
 * @see https://www.investopedia.com/terms/n/nvi.asp
 * @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/indicators/nvi.c
 */
export class NVI extends TrendIndicatorSeries<HighLowCloseVolume, TradingSignals, NVIState> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW_CLOSE_VOLUME;

  protected override state: NVIState = {nvi: 1_000, previousCandle: null};

  readonly #signalLine: EMA;

  public readonly signalInterval: number;

  /**
   * @param signalInterval Length of the moving average the index is read against; Fosback used about one year of
   * daily bars
   */
  constructor(signalInterval: number = 255) {
    super();
    this.signalInterval = signalInterval;
    this.#signalLine = new EMA(signalInterval);
  }

  override getRequiredInputs() {
    return 1;
  }

  update(candle: HighLowCloseVolume, replace: boolean) {
    /*
     * NVI accumulates onto a running index, so a replacement has to build on the index from
     * before the replaced candle.
     */
    this.trackState(replace);

    const previousCandle = this.state.previousCandle;

    // A previous close of zero offers no base to measure a price change against, so the index stays put
    if (previousCandle !== null && previousCandle.close !== 0 && candle.volume < previousCandle.volume) {
      const priceChangeRatio = (candle.close - previousCandle.close) / previousCandle.close;
      this.state.nvi += priceChangeRatio * this.state.nvi;
    }

    this.state.previousCandle = candle;

    this.#signalLine.update(this.state.nvi, replace);

    return this.setResult(this.state.nvi, replace);
  }

  protected calculateSignalState(result?: number | null) {
    const signalLine = this.#signalLine.isStable ? this.#signalLine.getResultOrThrow() : undefined;

    if (result === null || result === undefined || signalLine === undefined) {
      return TradingSignal.UNKNOWN;
    }

    if (result > signalLine) {
      return TradingSignal.BULLISH;
    }

    if (result < signalLine) {
      return TradingSignal.BEARISH;
    }

    return TradingSignal.SIDEWAYS;
  }
}
