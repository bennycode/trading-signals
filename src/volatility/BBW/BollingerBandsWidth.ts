import type {BollingerBands} from '../BBANDS/BollingerBands.js';
import {IndicatorSeries} from '../../types/Indicator.js';

/**
 * Bollinger Bands Width (BBW)
 * Type: Volatility
 *
 * The Bollinger Bands Width (BBW) indicator, developed by John A. Bollinger, merges the information of Bollinger Bands into one definite number. It defines the narrowness of the underlying Bollinger Bands by representing the difference between the Upper Band and the Lower Band.
 *
 * @see https://www.tradingview.com/support/solutions/43000501972-bollinger-bands-width-bbw/
 */
export class BollingerBandsWidth extends IndicatorSeries {
  constructor(public readonly bollingerBands: BollingerBands) {
    super();
  }

  override getRequiredInputs() {
    return this.bollingerBands.getRequiredInputs();
  }

  update(price: number, replace: boolean) {
    const result = this.bollingerBands.update(price, replace);
    if (result) {
      return this.setResult((result.upper - result.lower) / result.middle, replace);
    }

    return null;
  }
}
