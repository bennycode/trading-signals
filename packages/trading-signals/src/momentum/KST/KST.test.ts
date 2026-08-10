import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {KST} from './KST.js';
import {TradingSignal} from '../../base/index.js';

describe('KST', () => {
  // Short timeframes keep the warm-up at 6 candles, so the expectations stay hand-checkable.
  const fastConfig = {roc1: 1, roc2: 2, roc3: 3, roc4: 4, sma1: 2, sma2: 2, sma3: 2, sma4: 2} as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const kst = new KST(fastConfig);

      kst.updates([10, 12, 15, 20, 24, 30], false);

      const originalResult = kst.add(33);

      expect(originalResult?.toFixed(2)).toBe('892.50');

      /*
       * Replacing the newest price has to roll back all four rate-of-change chains:
       * 1 * 7.5 + 2 * 31.25 + 3 * 67.5 + 4 * 115 = 732.5
       */
      const replacedResult = kst.replace(27);

      expect(replacedResult?.toFixed(2)).toBe('732.50');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = kst.replace(33);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('matches the hand-derived reference values', () => {
      /*
       * Neither Tulip Indicators nor Skender's Stock.Indicators cover the KST — the latter has
       * no Kst implementation in the git trees of tags 3.0.0 or 2.7.3
       * (https://github.com/DaveSkender/Stock.Indicators/tree/3.0.0/src,
       * https://github.com/DaveSkender/Stock.Indicators/tree/2.7.3/src/e-k), so the expectations
       * are derived by hand from Pring's formula with 1/2/3/4-bar timeframes, all smoothed over
       * 2 bars.
       *
       * Percentage rates of change for the prices 10, 12, 15, 20, 24, 30, 33 (t0..t6):
       *   1-bar: 20, 25, 100/3, 20, 25, 10 (t1..t6)
       *   2-bar: 50, 200/3, 60, 50, 37.5 (t2..t6)
       *   3-bar: 100, 100, 100, 65 (t3..t6)
       *   4-bar: 140, 150, 120 (t4..t6)
       *
       * Weighted sums of the 2-bar averages:
       *   t5: 1 * 22.5 + 2 * 55 + 3 * 100 + 4 * 145 = 1012.5
       *   t6: 1 * 17.5 + 2 * 43.75 + 3 * 82.5 + 4 * 135 = 892.5
       */
      const prices = [10, 12, 15, 20, 24, 30, 33] as const;
      const expectations = ['1012.50', '892.50'] as const;
      const kst = new KST(fastConfig);
      const offset = kst.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = kst.add(price);

        if (result !== null) {
          expect(result.toFixed(2)).toBe(expectations[i - offset]);
        }
      });

      expect(kst.isStable).toBe(true);
      expect(kst.getRequiredInputs()).toBe(6);
    });

    it('reproduces the closed-form reading for constant-rate growth with the default timeframes', () => {
      /*
       * With prices growing 1% per bar, every percentage rate of change is constant
       * (100 * (1.01^n - 1)) and averaging a constant returns the constant, so the expected
       * reading follows in closed form, independently of this implementation:
       * 1 * ROC%(10) + 2 * ROC%(15) + 3 * ROC%(20) + 4 * ROC%(30) ≈ 247.85
       */
      const kst = new KST();

      for (let i = 0; i < 44; i++) {
        kst.add(100 * 1.01 ** i);
      }

      expect(kst.isStable).toBe(false);

      kst.add(100 * 1.01 ** 44);

      const closedForm =
        100 * (1 * (1.01 ** 10 - 1) + 2 * (1.01 ** 15 - 1) + 3 * (1.01 ** 20 - 1) + 4 * (1.01 ** 30 - 1));

      expect(kst.getResultOrThrow()).toBeCloseTo(closedForm, 9);
      expect(kst.getResultOrThrow().toFixed(2)).toBe('247.85');
    });
  });

  describe('getRequiredInputs', () => {
    it('reports the warm-up of the slowest smoothing chain', () => {
      expect(new KST().getRequiredInputs()).toBe(45);
      expect(new KST(fastConfig).getRequiredInputs()).toBe(6);
      // A short-horizon chain dominates the warm-up when it is configured slower than the long one.
      expect(
        new KST({roc1: 10, roc2: 2, roc3: 2, roc4: 2, sma1: 10, sma2: 2, sma3: 2, sma4: 2}).getRequiredInputs()
      ).toBe(20);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN while the indicator warms up', () => {
      const kst = new KST(fastConfig);

      expect(kst.getSignal()).toStrictEqual({hasChanged: false, state: TradingSignal.UNKNOWN});

      kst.add(10);

      expect(kst.getSignal()).toStrictEqual({hasChanged: false, state: TradingSignal.UNKNOWN});
    });

    it('returns BULLISH when momentum is positive across timeframes', () => {
      const kst = new KST(fastConfig);

      kst.updates([10, 12, 15, 20, 24, 30], false);

      expect(kst.getResultOrThrow().toFixed(2)).toBe('1012.50');
      expect(kst.getSignal()).toStrictEqual({hasChanged: true, state: TradingSignal.BULLISH});
    });

    it('returns BEARISH when momentum is negative across timeframes', () => {
      const kst = new KST(fastConfig);

      kst.updates([33, 30, 24, 20, 15, 12], false);

      expect(kst.getResultOrThrow().toFixed(2)).toBe('-479.09');
      expect(kst.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when prices do not move', () => {
      const kst = new KST(fastConfig);

      for (let i = 0; i < 6; i++) {
        kst.add(50);
      }

      expect(kst.getResultOrThrow()).toBe(0);
      expect(kst.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags the change when momentum flips', () => {
      const kst = new KST(fastConfig);

      kst.updates([10, 12, 15, 20, 24, 30], false);

      expect(kst.getSignal()).toStrictEqual({hasChanged: true, state: TradingSignal.BULLISH});

      kst.add(5);

      // The heavier weights of the long timeframes keep the reading positive after a single crash bar.
      expect(kst.getResultOrThrow()).toBeGreaterThan(0);
      expect(kst.getSignal()).toStrictEqual({hasChanged: false, state: TradingSignal.BULLISH});

      kst.add(5);

      expect(kst.getResultOrThrow()).toBeLessThan(0);
      expect(kst.getSignal()).toStrictEqual({hasChanged: true, state: TradingSignal.BEARISH});
    });
  });
});

testIndicatorContract({
  create: () => new KST({roc1: 1, roc2: 2, roc3: 3, roc4: 4, sma1: 2, sma2: 2, sma3: 2, sma4: 2}),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84],
});
