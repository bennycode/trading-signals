import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {RCI} from './RCI.js';
import {TradingSignal} from '../../base/index.js';

describe('RCI', () => {
  describe('constructor', () => {
    it('rejects an interval below 2', () => {
      expect(() => new RCI(1)).toThrowError('The interval has to be at least 2, but "1" was given.');
    });

    it('defaults to the conventional short-term interval of 9', () => {
      const rci = new RCI();

      expect(rci.getRequiredInputs()).toBe(9);

      for (let i = 1; i <= 9; i++) {
        rci.add(i);
      }

      expect(rci.getResultOrThrow()).toBe(100);
    });
  });

  describe('getResultOrThrow', () => {
    it('reads exactly +100 when every close is higher than the previous one', () => {
      const closes = [1, 2, 3, 4, 5] as const;
      const rci = new RCI(5);

      for (const close of closes) {
        rci.add(close);
      }

      expect(rci.getResultOrThrow()).toBe(100);
    });

    it('reads exactly -100 when every close is lower than the previous one', () => {
      const closes = [5, 4, 3, 2, 1] as const;
      const rci = new RCI(5);

      for (const close of closes) {
        rci.add(close);
      }

      expect(rci.getResultOrThrow()).toBe(-100);
    });

    /*
     * Hand-derived Spearman worksheet for the window [3, 1, 4, 2, 5] (oldest → newest):
     *
     * | Close | Time rank (newest = 1) | Price rank (highest = 1) | d  | d² |
     * |-------|------------------------|--------------------------|----|----|
     * | 3     | 5                      | 3                        |  2 |  4 |
     * | 1     | 4                      | 5                        | -1 |  1 |
     * | 4     | 3                      | 2                        |  1 |  1 |
     * | 2     | 2                      | 4                        | -2 |  4 |
     * | 5     | 1                      | 1                        |  0 |  0 |
     *
     * Σd² = 10 and n(n² - 1) = 5 × 24 = 120, so RCI = (1 - 6 × 10 / 120) × 100 = 50.
     */
    it('scores a mixed window by how well the price ranking agrees with the time ranking', () => {
      const closes = [3, 1, 4, 2, 5] as const;
      const rci = new RCI(5);

      for (const close of closes) {
        rci.add(close);
      }

      expect(rci.getResultOrThrow()).toBe(50);
    });

    /*
     * The two equal closes occupy the price rank positions 2 and 3, so each receives their
     * average of 2.5 (standard Spearman tie handling):
     *
     * | Close | Time rank (newest = 1) | Price rank (highest = 1) | d    | d²   |
     * |-------|------------------------|--------------------------|------|------|
     * | 2     | 4                      | 2.5                      |  1.5 | 2.25 |
     * | 2     | 3                      | 2.5                      |  0.5 | 0.25 |
     * | 3     | 2                      | 1                        |  1   | 1    |
     * | 1     | 1                      | 4                        | -3   | 9    |
     *
     * Σd² = 12.5 and n(n² - 1) = 4 × 15 = 60, so RCI = (1 - 6 × 12.5 / 60) × 100 = -25.
     */
    it('averages the ranks of equal closes', () => {
      const closes = [2, 2, 3, 1] as const;
      const rci = new RCI(4);

      for (const close of closes) {
        rci.add(close);
      }

      expect(rci.getResultOrThrow()).toBe(-25);
    });

    /*
     * With every close tied, the averaged ranks land mid-range instead of at an extreme,
     * so a dead market never reads as a persistent trend.
     */
    it('stays far away from the extremes for a completely flat market', () => {
      const rci = new RCI(4);

      for (let i = 0; i < 4; i++) {
        rci.add(7);
      }

      expect(rci.getResultOrThrow()).toBe(50);
      expect(rci.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const closes = [3, 1, 4, 2, 5] as const;
      const rci = new RCI(5);

      for (const close of closes) {
        rci.add(close);
      }

      const originalResult = rci.add(6);

      expect(originalResult).toBe(90);

      const replacedResult = rci.replace(3);

      expect(replacedResult).toBe(50);

      const restoredResult = rci.replace(6);

      expect(restoredResult).toBe(90);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const rci = new RCI(5);

      expect(rci.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when the RCI indicates an overbought market', () => {
      const rci = new RCI(5);

      for (const close of [1, 2, 3, 4, 5] as const) {
        rci.add(close);
      }

      expect(rci.getResultOrThrow()).toBe(100);
      expect(rci.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BULLISH when the RCI sits exactly on the overbought threshold', () => {
      const rci = new RCI(5);

      for (const close of [2, 1, 3, 5, 4] as const) {
        rci.add(close);
      }

      expect(rci.getResultOrThrow()).toBe(80);
      expect(rci.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the RCI indicates an oversold market', () => {
      const rci = new RCI(5);

      for (const close of [5, 4, 3, 2, 1] as const) {
        rci.add(close);
      }

      expect(rci.getResultOrThrow()).toBe(-100);
      expect(rci.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns BEARISH when the RCI sits exactly on the oversold threshold', () => {
      const rci = new RCI(5);

      for (const close of [4, 5, 3, 1, 2] as const) {
        rci.add(close);
      }

      expect(rci.getResultOrThrow()).toBe(-80);
      expect(rci.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the RCI is between the oversold and overbought thresholds', () => {
      const rci = new RCI(5);

      for (const close of [3, 1, 4, 2, 5] as const) {
        rci.add(close);
      }

      expect(rci.getResultOrThrow()).toBe(50);
      expect(rci.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('respects custom overbought and oversold thresholds', () => {
      const strictRci = new RCI(5, {overbought: 90, oversold: -90});

      for (const close of [2, 1, 3, 5, 4] as const) {
        strictRci.add(close);
      }

      expect(strictRci.getResultOrThrow()).toBe(80);
      expect(strictRci.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      const looseRci = new RCI(5, {overbought: 40, oversold: -40});

      for (const close of [3, 1, 4, 2, 5] as const) {
        looseRci.add(close);
      }

      expect(looseRci.getResultOrThrow()).toBe(50);
      expect(looseRci.getSignal().state).toBe(TradingSignal.BULLISH);
    });
  });
});

testIndicatorContract({
  create: () => new RCI(5),
  divergentInput: 1_000,
  inputs: [3, 1, 4, 2, 5, 6, 3],
});
