import type {HighLowClose} from '../../base/Candle.type.js';
import {IndicatorInputShape, IndicatorSeries} from '../../base/Indicator.js';

type WADState = {
  previousClose: number | null;
  wad: number;
};

/**
 * Williams Accumulation/Distribution (WAD)
 * Type: Volume
 *
 * Developed by Larry Williams, this cumulative line tracks which side won each bar: buyers who managed to
 * close the bar higher get credited with the full run from the bar's true low up to the close, sellers who
 * closed it lower get charged the drop from the true high down to the close.
 *
 * Despite the shared name, it is unrelated to Chaikin's Accumulation/Distribution (AD): Chaikin weights each
 * bar by volume and by where the close sits inside the high-low range, whereas Williams' line is built from
 * price alone. "Accumulation/Distribution" here is Williams' reading of who controlled the bar, which is why
 * the indicator is conventionally filed with the accumulation/distribution (volume) tools even though it
 * consumes no volume.
 *
 * Formula:
 * A close above the previous close adds the distance from the true low (the lower of the current low and the
 * previous close) up to the close. A close below the previous close subtracts the distance from the true high
 * (the higher of the current high and the previous close) down to the close. An unchanged close leaves the
 * line untouched.
 *
 * Interpretation:
 * The absolute level carries no meaning — the line is read against price for divergence. A fresh price high
 * that the line refuses to confirm warns of distribution, while a fresh price low against a rising line hints
 * at accumulation. Compare the line's direction with price — this class does not emit a standalone signal.
 *
 * @see https://tulipindicators.org/wad
 * @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/indicators/wad.c
 */
export class WAD extends IndicatorSeries<HighLowClose<number>, WADState> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW_CLOSE;

  protected override state: WADState = {previousClose: null, wad: 0};

  override getRequiredInputs() {
    return 2;
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    /*
     * WAD accumulates onto a running total, so a replacement has to build on the total from
     * before the replaced candle.
     */
    this.trackState(replace);

    const previousClose = this.state.previousClose;
    this.state.previousClose = candle.close;

    if (previousClose === null) {
      return null;
    }

    // An unchanged close means neither side won the bar, so the line stays flat
    if (candle.close > previousClose) {
      this.state.wad += candle.close - Math.min(candle.low, previousClose);
    } else if (candle.close < previousClose) {
      this.state.wad += candle.close - Math.max(candle.high, previousClose);
    }

    return this.setResult(this.state.wad, replace);
  }
}
