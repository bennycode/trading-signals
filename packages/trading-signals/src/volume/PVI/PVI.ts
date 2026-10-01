import type {HighLowCloseVolume} from '../../base/Candle.type.js';
import {IndicatorInputShape, TradingSignal, type TradingSignals, TrendIndicatorSeries} from '../../base/Indicator.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {pushUpdate} from '../../util/array/pushUpdate.js';

type PVIState = {
  candles: HighLowCloseVolume[];
  pvi: number;
};

/**
 * Positive Volume Index (PVI)
 * Type: Volume
 *
 * Devised by Paul Dysart and popularized by Norman Fosback, the Positive Volume Index isolates
 * what price does on days when volume expands — the days the excitable crowd is most active.
 * The index starts at 1000 and compounds the closing price change only on bars whose volume
 * exceeds the previous bar's volume; on shrinking or unchanged volume it stays flat. Its
 * counterpart NVI does the opposite and follows the quiet days attributed to smart money.
 *
 * Interpretation: PVI is read against its own long moving average (Fosback used roughly one
 * year of daily bars). An index above that average suggests bull-market odds, while an index
 * below it warns that a bear market is more likely — crowd buying has dried up. The signal follows
 * that reading, against an EMA of the index that is one year of daily bars long unless
 * configured otherwise.
 *
 * @see https://www.investopedia.com/terms/p/pvi.asp
 * @see https://tulipindicators.org/pvi
 */
export class PVI extends TrendIndicatorSeries<HighLowCloseVolume, TradingSignals, PVIState> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW_CLOSE_VOLUME;

  protected override state: PVIState = {candles: [], pvi: 1_000};

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
    this.trackState(replace);

    // A replacement has already rewound to the state from before the replaced candle, so the incoming candle is always appended
    pushUpdate({array: this.state.candles, item: candle, maxLength: 2, replace: false});

    if (this.state.candles.length === 2) {
      const previous = this.state.candles[0];

      /*
       * Only a crowd day (expanding volume) moves the index; quiet days leave it untouched.
       * A previous close of zero offers no base to measure a price change against, so the index stays put.
       */
      if (previous.close !== 0 && candle.volume > previous.volume) {
        this.state.pvi += ((candle.close - previous.close) / previous.close) * this.state.pvi;
      }
    }

    this.#signalLine.update(this.state.pvi, replace);

    return this.setResult(this.state.pvi, replace);
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
