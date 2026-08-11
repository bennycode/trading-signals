import {TradingSignal} from '../../base/Indicator.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {CVI} from './CVI.js';

describe('CVI', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L131-L134
   */
  const highs = [
    82.15, 81.89, 83.03, 83.3, 83.85, 83.9, 83.33, 84.3, 84.84, 85.0, 85.9, 86.58, 86.98, 88.0, 87.87,
  ] as const;
  const lows = [
    81.29, 80.64, 81.31, 82.65, 83.07, 83.11, 82.49, 82.3, 84.15, 84.11, 84.03, 85.39, 85.76, 87.17, 87.01,
  ] as const;
  const expectations = ['5.682', '44.088', '43.317', '-0.494', '3.994', '1.824'] as const;

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const interval = 5;
      const cvi = new CVI(interval);
      const offset = cvi.getRequiredInputs() - 1;

      highs.forEach((high, i) => {
        const result = cvi.add({high, low: lows[i]});

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(cvi.isStable).toBe(true);
      expect(cvi.getRequiredInputs()).toBe(interval * 2);
    });

    it('defaults to the 10-bar setting popularized by Marc Chaikin', () => {
      const cvi = new CVI();

      expect(cvi.interval).toBe(10);
      expect(cvi.getRequiredInputs()).toBe(20);
    });

    it('reports zero change in a dead-flat market instead of an undefined percentage', () => {
      const cvi = new CVI(5);

      for (let i = 0; i < 10; i++) {
        cvi.add({high: 100, low: 100});
      }

      expect(cvi.getResultOrThrow()).toBe(0);
      expect(cvi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('stays at zero when volatility appears without a baseline to compare against', () => {
      const cvi = new CVI(5);

      for (let i = 0; i < 9; i++) {
        cvi.add({high: 100, low: 100});
      }

      cvi.add({high: 105, low: 95});

      expect(cvi.getResultOrThrow()).toBe(0);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const cvi = new CVI(5);

      highs.forEach((high, i) => {
        cvi.add({high, low: lows[i]});
      });

      const originalValue = {high: 90, low: 80} as const;
      const replacedValue = {high: 88, low: 87.5} as const;

      const originalResult = cvi.add(originalValue);

      expect(originalResult?.toFixed(3)).toBe('210.296');

      const replacedResult = cvi.replace(replacedValue);

      expect(replacedResult?.toFixed(3)).toBe('-34.332');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = cvi.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });

    it('simply adds a candle when there is no candle to replace', () => {
      const cvi = new CVI(5);

      cvi.replace({high: highs[0], low: lows[0]});

      highs.slice(1, 10).forEach((high, i) => {
        cvi.add({high, low: lows[i + 1]});
      });

      expect(cvi.getResultOrThrow().toFixed(3)).toBe('5.682');
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const cvi = new CVI(5);

      expect(cvi.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH while trading ranges are widening', () => {
      const cvi = new CVI(5);

      for (let i = 0; i < 10; i++) {
        cvi.add({high: 100 + i, low: 100 - i});
      }

      expect(cvi.getResultOrThrow()).toBeGreaterThan(0);
      expect(cvi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH while trading ranges are narrowing', () => {
      const cvi = new CVI(5);

      for (let i = 0; i < 10; i++) {
        cvi.add({high: 100 + (20 - i), low: 100 - (20 - i)});
      }

      expect(cvi.getResultOrThrow()).toBeLessThan(0);
      expect(cvi.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('flags the flip from expanding to contracting volatility', () => {
      const cvi = new CVI(5);

      for (let i = 0; i < 10; i++) {
        cvi.add({high: 100 + i, low: 100 - i});
      }

      expect(cvi.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BULLISH,
      });

      cvi.add({high: 100.5, low: 99.5});

      expect(cvi.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BULLISH,
      });

      cvi.add({high: 100.5, low: 99.5});

      expect(cvi.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });
  });
});

testIndicatorContract({
  create: () => new CVI(3),
  divergentInput: {high: 1_000, low: 900},
  inputs: [
    {high: 82.15, low: 81.29},
    {high: 81.89, low: 80.64},
    {high: 83.03, low: 81.31},
    {high: 83.3, low: 82.65},
    {high: 83.85, low: 83.07},
    {high: 83.9, low: 83.11},
  ],
});
