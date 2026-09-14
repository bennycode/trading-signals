import {IndicatorInputShape, ZeroCrossSeries} from '../../base/Indicator.js';
import {SMA} from '../../trend/SMA/SMA.js';
import {ROC} from '../ROC/ROC.js';

export type KSTConfig = {
  /** Lookback of the shortest rate-of-change timeframe (default: 10) */
  roc1?: number;
  /** Lookback of the second rate-of-change timeframe (default: 15) */
  roc2?: number;
  /** Lookback of the third rate-of-change timeframe (default: 20) */
  roc3?: number;
  /** Lookback of the longest rate-of-change timeframe (default: 30) */
  roc4?: number;
  /** Smoothing period for the shortest timeframe (default: 10) */
  sma1?: number;
  /** Smoothing period for the second timeframe (default: 10) */
  sma2?: number;
  /** Smoothing period for the third timeframe (default: 10) */
  sma3?: number;
  /** Smoothing period for the longest timeframe (default: 15) */
  sma4?: number;
};

type WeightedChain = {
  roc: ROC;
  sma: SMA;
  weight: number;
};

/**
 * Know Sure Thing (KST)
 * Type: Momentum
 *
 * Developed by Martin Pring, the KST blends the smoothed percentage rate of change of four timeframes into a
 * single momentum oscillator, weighting the longer timeframes more heavily (1x to 4x). A single-timeframe rate
 * of change whipsaws on every short-lived swing; requiring four horizons to agree filters those out, so the KST
 * reflects the dominant momentum cycle rather than the latest twitch.
 *
 * Interpretation: readings above zero mean bullish momentum across timeframes, readings below zero mean bearish
 * momentum. Pring additionally pairs the oscillator with a 9-period SMA signal line — feed the KST readings into
 * an SMA(9) to reproduce it.
 *
 * @see https://www.investopedia.com/terms/k/know-sure-thing-kst.asp
 * @see https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/know-sure-thing-kst
 */
export class KST extends ZeroCrossSeries {
  override readonly inputShape = IndicatorInputShape.VALUE;

  readonly #chains: readonly WeightedChain[];

  constructor({
    roc1 = 10,
    roc2 = 15,
    roc3 = 20,
    roc4 = 30,
    sma1 = 10,
    sma2 = 10,
    sma3 = 10,
    sma4 = 15,
  }: KSTConfig = {}) {
    super();
    this.#chains = [
      {roc: new ROC(roc1), sma: new SMA(sma1), weight: 1},
      {roc: new ROC(roc2), sma: new SMA(sma2), weight: 2},
      {roc: new ROC(roc3), sma: new SMA(sma3), weight: 3},
      {roc: new ROC(roc4), sma: new SMA(sma4), weight: 4},
    ];
  }

  override getRequiredInputs() {
    // A smoothing window only starts filling once its rate-of-change lookback is filled.
    return Math.max(...this.#chains.map(({roc, sma}) => roc.interval + sma.interval));
  }

  update(price: number, replace: boolean) {
    let weightedSum = 0;
    let isWarmingUp = false;

    for (const {roc, sma, weight} of this.#chains) {
      const rateOfChange = roc.update(price, replace);
      const smoothed = rateOfChange === null ? null : sma.update(rateOfChange, replace);

      if (smoothed === null) {
        isWarmingUp = true;
      } else {
        weightedSum += weight * smoothed;
      }
    }

    if (isWarmingUp) {
      return null;
    }

    /*
     * Pring's formula weights percentage rates of change, while the rate of change used here
     * reports a fraction, so the weighted sum is scaled to the conventional percent reading.
     */
    return this.setResult(weightedSum * 100, replace);
  }
}
