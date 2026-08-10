import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {APO} from './APO.js';
import {TradingSignal} from '../../base/index.js';

describe('APO', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L50-L52
   *
   * Tulip emits results from the 2nd candle onward; this implementation waits until the slow
   * EMA is stable, so the first three Tulip values are skipped and the remaining ones match.
   */
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expectations = [
    '0.618',
    '0.351',
    '0.111',
    '0.416',
    '0.578',
    '0.422',
    '0.684',
    '0.927',
    '0.891',
    '0.979',
    '0.621',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const apo = new APO({fastPeriod: 2, slowPeriod: 5});

      apo.updates(prices, false);

      const originalValue = 90;
      const replacedValue = 83;

      const originalResult = apo.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('1.31');

      const replacedResult = apo.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('-1.03');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = apo.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const apo = new APO({fastPeriod: 2, slowPeriod: 5});
      const offset = apo.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = apo.add(price);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(apo.isStable).toBe(true);
      expect(apo.getRequiredInputs()).toBe(5);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const apo = new APO();

      expect(apo.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH when the fast EMA is above the slow EMA', () => {
      const apo = new APO({fastPeriod: 2, slowPeriod: 5});

      for (let i = 0; i < 6; i++) {
        apo.add(100 + i);
      }

      expect(apo.getResultOrThrow()).toBeGreaterThan(0);
      expect(apo.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BULLISH,
      });
    });

    it('returns BEARISH when the fast EMA is below the slow EMA', () => {
      const apo = new APO({fastPeriod: 2, slowPeriod: 5});

      for (let i = 0; i < 6; i++) {
        apo.add(100 - i);
      }

      expect(apo.getResultOrThrow()).toBeLessThan(0);
      expect(apo.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BEARISH,
      });
    });

    it('returns SIDEWAYS when the fast and slow EMA are equal', () => {
      const apo = new APO({fastPeriod: 2, slowPeriod: 5});

      for (let i = 0; i < 6; i++) {
        apo.add(100);
      }

      expect(apo.getResultOrThrow()).toBe(0);
      expect(apo.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.SIDEWAYS,
      });
    });

    it('reports a signal change when the oscillator crosses the zero line', () => {
      const apo = new APO({fastPeriod: 2, slowPeriod: 5});

      for (let i = 0; i < 6; i++) {
        apo.add(100 - i);
      }

      expect(apo.getSignal().state).toBe(TradingSignal.BEARISH);

      apo.add(200);

      expect(apo.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BULLISH,
      });
    });
  });
});

testIndicatorContract({
  create: () => new APO({fastPeriod: 2, slowPeriod: 5}),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84],
});
