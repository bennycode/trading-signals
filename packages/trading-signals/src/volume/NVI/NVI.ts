import type {HighLowCloseVolume} from '../../base/Candle.type.js';
import {IndicatorSeries} from '../../base/Indicator.js';

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
 * average historically indicated high odds of a bull market. Compare the index to a long moving average of itself —
 * this class does not emit a standalone signal.
 *
 * @see https://www.investopedia.com/terms/n/nvi.asp
 * @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/indicators/nvi.c
 */
export class NVI extends IndicatorSeries<HighLowCloseVolume, NVIState> {
  protected override state: NVIState = {nvi: 1_000, previousCandle: null};

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

    if (previousCandle !== null && candle.volume < previousCandle.volume) {
      const priceChangeRatio = (candle.close - previousCandle.close) / previousCandle.close;
      this.state.nvi += priceChangeRatio * this.state.nvi;
    }

    this.state.previousCandle = candle;

    return this.setResult(this.state.nvi, replace);
  }
}
