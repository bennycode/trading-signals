import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator';
import {Big, BigSource} from 'big.js';
import {BollingerBands, FasterBollingerBands} from '../BBANDS/BollingerBands';

/**
 * The Bollinger Bands Width (BBW) indicator, developed by John A. Bollinger, merges the information of Bollinger Bands
 * into one definite number. It represents the difference between the Upper Band and the Lower Band to define the
 * narrowness of the underlying Bollinger Bands.
 *
 * @see https://www.tradingview.com/support/solutions/43000501972-bollinger-bands-width-bbw/
 */
export class BollingerBandsWidth extends BigIndicatorSeries {
  constructor(public readonly bollingerBands: BollingerBands) {
    super();
  }

  override update(price: BigSource): void | Big {
    const result = this.bollingerBands.update(price);
    if (result) {
      return this.setResult(result.upper.minus(result.lower).div(result.middle));
    }
  }
}

export class FasterBollingerBandsWidth extends NumberIndicatorSeries {
  constructor(public readonly bollingerBands: FasterBollingerBands) {
    super();
  }

  override update(price: number): void | number {
    const result = this.bollingerBands.update(price);
    if (result) {
      return this.setResult((result.upper - result.lower) / result.middle);
    }
  }
}
