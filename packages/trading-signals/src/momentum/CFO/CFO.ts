import {ZeroCrossSeries} from '../../base/Indicator.js';
import {getLinearRegression} from '../../util/getLinearRegression.js';
import {pushUpdate} from '../../util/pushUpdate.js';

/**
 * Chande Forecast Oscillator (CFO)
 * Type: Momentum
 *
 * Developed by Tushar Chande, the oscillator measures how far the close deviates from the close its
 * own trend had projected for that bar, expressed as a percentage of the close. The projection is a
 * least-squares regression line fitted through the preceding closes of the interval and extended one
 * bar ahead — the "time series forecast" (TSF). Tulip Indicators ships the same close-to-forecast
 * comparison as its Forecast Oscillator.
 *
 * Interpretation:
 * Positive readings mean price runs ahead of its own trend's projection (bullish pressure), negative
 * readings mean price falls short of it (bearish pressure). A zero-line cross marks the moment price
 * switches from lagging its trend to leading it, or vice versa. A close of zero makes the percentage
 * deviation undefined, so the oscillator reports the neutral zero line instead — a worthless
 * instrument exerts no directional pressure.
 *
 * @see https://tulipindicators.org/fosc
 * @see https://www.fmlabs.com/reference/default.htm?url=ForecastOscillator.htm
 */
export class CFO extends ZeroCrossSeries {
  readonly #closes: number[] = [];

  public readonly interval: number;

  constructor(interval: number = 14) {
    super();

    // A single point cannot define a trend line to project, so a forecast would be fabricated
    if (!Number.isFinite(interval) || interval < 2) {
      throw new Error(`The interval has to be at least 2, but "${interval}" was given.`);
    }

    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval + 1;
  }

  update(close: number, replace: boolean) {
    pushUpdate({array: this.#closes, item: close, maxLength: this.getRequiredInputs(), replace: replace});

    if (this.#closes.length < this.getRequiredInputs()) {
      return null;
    }

    // A dead market never fabricates a directional signal
    if (close === 0) {
      return this.setResult(0, replace);
    }

    // The forecast for the newest bar is fitted over the closes that precede it
    const {prediction: forecast} = getLinearRegression(this.#closes.slice(0, this.interval));

    return this.setResult((100 * (close - forecast)) / close, replace);
  }
}
