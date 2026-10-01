import type {HighLowCloseVolume} from '../../base/Candle.type.js';
import {IndicatorInputShape, IndicatorSeries} from '../../base/Indicator.js';
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
 * below it warns that a bear market is more likely — crowd buying has dried up.
 *
 * @see https://www.investopedia.com/terms/p/pvi.asp
 * @see https://tulipindicators.org/pvi
 */
export class PVI extends IndicatorSeries<HighLowCloseVolume, PVIState> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW_CLOSE_VOLUME;

  protected override state: PVIState = {candles: [], pvi: 1_000};

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

    return this.setResult(this.state.pvi, replace);
  }
}
