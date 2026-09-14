import {IndicatorInputShape, IndicatorSeries} from '../../base/Indicator.js';
import {pushUpdate} from '../../util/index.js';

/**
 * Ulcer Index (UI)
 * Type: Volatility
 *
 * Developed by Peter Martin in 1987, the Ulcer Index measures downside volatility: the root mean
 * square of percentage drawdowns from the highest close within its window. Unlike the standard
 * deviation, which punishes upside moves just as much as losses, it only registers stress while the
 * price sits below a recent high — and because every bar spent underwater keeps contributing, it
 * penalizes the duration of a drawdown as well as its depth. A reading of 0 means the price never
 * dropped below a running high; higher readings mean deeper and/or longer drawdowns.
 *
 * @see http://www.tangotools.com/ui/ui.htm
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:ulcer_index
 */
export class UlcerIndex extends IndicatorSeries {
  override readonly inputShape = IndicatorInputShape.VALUE;

  readonly #closes: number[] = [];

  public readonly interval: number;

  constructor(interval: number = 14) {
    super();
    this.interval = interval;
  }

  override getRequiredInputs() {
    return this.interval;
  }

  update(close: number, replace: boolean) {
    pushUpdate({array: this.#closes, item: close, maxLength: this.interval, replace});

    if (this.#closes.length < this.interval) {
      return null;
    }

    let highestClose = -Infinity;
    let squaredDrawdownSum = 0;

    for (const currentClose of this.#closes) {
      if (currentClose > highestClose) {
        highestClose = currentClose;
      }

      // A highest close of zero leaves no value to draw down from, so such a bar reads as no drawdown
      const percentageDrawdown = highestClose === 0 ? 0 : (100 * (currentClose - highestClose)) / highestClose;
      squaredDrawdownSum += percentageDrawdown ** 2;
    }

    return this.setResult(Math.sqrt(squaredDrawdownSum / this.interval), replace);
  }
}
