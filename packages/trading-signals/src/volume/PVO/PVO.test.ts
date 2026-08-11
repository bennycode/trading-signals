import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {PVO} from './PVO.js';
import {TradingSignal} from '../../base/index.js';

describe('PVO', () => {
  /*
   * There is no Tulip Indicators baseline for the PVO, and third-party baselines
   * (e.g. Skender.Stock.Indicators v3.0.0) seed their EMAs with an SMA of the first raw
   * volumes. An SMA-seeded EMA never coincides with an EMA seeded from the first value — the
   * seeding difference only decays geometrically — so those baselines are not reproducible
   * here. The expectations below are derived by hand instead, with a fast period of 2
   * (smoothing weight 2/3) and a slow period of 5 (smoothing weight 1/3). The volumes are
   * multiples of 3^5 = 243, which keeps every EMA reading an integer:
   *
   * volume | fast EMA(2) | slow EMA(5) | PVO
   *    243 |         243 |         243 |  -
   *    486 |         405 |         324 |  -
   *    729 |         621 |         459 |  -
   *    972 |         855 |         630 |  -
   *   1215 |        1095 |         825 | 100 * (1095 - 825) / 825 = 32.7272...
   *   1458 |        1337 |        1036 | 100 * (1337 - 1036) / 1036 = 29.0540...
   *
   * The slow EMA is only considered stable from the 5th volume onwards, so 32.73 is the
   * first result.
   *
   * @see https://school.stockcharts.com/doku.php?id=technical_indicators:percentage_volume_oscillator_pvo
   */
  const volumes = [243, 486, 729, 972, 1215, 1458] as const;
  const expectations = ['32.73', '29.05'] as const;

  describe('constructor', () => {
    it('mirrors the PPO defaults of a 12-candle fast and a 26-candle slow EMA', () => {
      const pvo = new PVO();

      expect(pvo.fastPeriod).toBe(12);
      expect(pvo.slowPeriod).toBe(26);
      expect(pvo.getRequiredInputs()).toBe(26);
    });
  });

  describe('getResultOrThrow', () => {
    it('reports the spread between the fast and slow volume EMA as a percentage of the slow EMA', () => {
      const pvo = new PVO({fastPeriod: 2, slowPeriod: 5});
      const offset = pvo.getRequiredInputs() - 1;

      volumes.forEach((volume, i) => {
        const result = pvo.add(volume);

        if (result !== null) {
          expect(result.toFixed(2)).toBe(expectations[i - offset]);
        }
      });

      expect(pvo.isStable).toBe(true);
      expect(pvo.getRequiredInputs()).toBe(5);
    });

    it('reports zero for a halted market instead of dividing by zero', () => {
      const pvo = new PVO({fastPeriod: 2, slowPeriod: 5});

      for (let i = 0; i < 5; i++) {
        pvo.add(0);
      }

      expect(pvo.getResultOrThrow()).toBe(0);
      expect(pvo.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added volume', () => {
      const pvo = new PVO({fastPeriod: 2, slowPeriod: 5});

      for (const volume of volumes) {
        pvo.add(volume);
      }

      const originalValue = 2_916;
      const replacedValue = 243;

      const originalResult = pvo.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('43.72');

      const replacedResult = pvo.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('-21.25');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = pvo.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const pvo = new PVO();

      expect(pvo.getSignal()).toStrictEqual({hasChanged: false, state: TradingSignal.UNKNOWN});
    });

    it('returns BULLISH while volume is expanding', () => {
      const pvo = new PVO({fastPeriod: 2, slowPeriod: 5});

      for (let i = 1; i <= 5; i++) {
        pvo.add(100 * i);
      }

      expect(pvo.getResultOrThrow()).toBeGreaterThan(0);
      expect(pvo.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH while volume is drying up', () => {
      const pvo = new PVO({fastPeriod: 2, slowPeriod: 5});

      for (let i = 1; i <= 5; i++) {
        pvo.add(600 - 100 * i);
      }

      expect(pvo.getResultOrThrow()).toBeLessThan(0);
      expect(pvo.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when volume never changes', () => {
      const pvo = new PVO({fastPeriod: 2, slowPeriod: 5});

      for (let i = 0; i < 5; i++) {
        pvo.add(500);
      }

      expect(pvo.getResultOrThrow()).toBe(0);
      expect(pvo.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags the change when the volume regime flips from expansion to contraction', () => {
      const pvo = new PVO({fastPeriod: 2, slowPeriod: 5});

      for (let i = 1; i <= 5; i++) {
        pvo.add(100 * i);
      }

      expect(pvo.getSignal()).toStrictEqual({hasChanged: true, state: TradingSignal.BULLISH});

      pvo.add(10);

      expect(pvo.getSignal()).toStrictEqual({hasChanged: true, state: TradingSignal.BEARISH});

      pvo.add(10);

      expect(pvo.getSignal()).toStrictEqual({hasChanged: false, state: TradingSignal.BEARISH});
    });
  });
});

testIndicatorContract({
  create: () => new PVO({fastPeriod: 2, slowPeriod: 5}),
  divergentInput: 1_000_000,
  inputs: [243, 486, 729, 972, 1215, 1458, 1701],
});
