import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import type {BollingerBands, FasterBollingerBands} from '../BBANDS/BollingerBands.js';
import type {BigSource} from 'big.js';

/**
 * Bollinger Bands Width (BBW)
 * Type: Volatility
 *
 * The Bollinger Bands Width (BBW) indicator, developed by John A. Bollinger, merges the information of Bollinger Bands
 * into one definite number. It defines the narrowness of the underlying Bollinger Bands by representing the difference
 * between the Upper Band and the Lower Band.
 *
 * @see https://www.tradingview.com/support/solutions/43000501972-bollinger-bands-width-bbw/
 */
export class BollingerBandsWidth extends BigIndicatorSeries {
  constructor(public readonly bollingerBands: BollingerBands) {
    super();
  }

  override getRequiredInputs() {
    return this.bollingerBands.getRequiredInputs();
  }

  update(price: BigSource, replace: boolean) {
    const result = this.bollingerBands.update(price, replace);
    if (result) {
      return this.setResult(result.upper.minus(result.lower).div(result.middle), replace);
    }

    return null;
  }
}

export class FasterBollingerBandsWidth extends NumberIndicatorSeries {
  constructor(public readonly bollingerBands: FasterBollingerBands) {
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
