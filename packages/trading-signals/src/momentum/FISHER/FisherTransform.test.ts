import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {TradingSignal} from '../../base/Indicator.js';
import {FisherTransform} from './FisherTransform.js';

describe('FisherTransform', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L189-L193
   */
  const highs = [
    82.15, 81.89, 83.03, 83.3, 83.85, 83.9, 83.33, 84.3, 84.84, 85.0, 85.9, 86.58, 86.98, 88.0, 87.87,
  ] as const;
  const lows = [
    81.29, 80.64, 81.31, 82.65, 83.07, 83.11, 82.49, 82.3, 84.15, 84.11, 84.03, 85.39, 85.76, 87.17, 87.01,
  ] as const;
  const expectations = [
    '0.343',
    '0.791',
    '0.825',
    '0.806',
    '1.066',
    '1.439',
    '1.851',
    '2.275',
    '2.698',
    '3.117',
    '3.185',
  ] as const;

  describe('constructor', () => {
    it('defaults to an interval of 10 as popularized by John Ehlers', () => {
      const fisherTransform = new FisherTransform();

      expect(fisherTransform.getRequiredInputs()).toBe(10);
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the Fisher Transform with an interval of 5', {tags: ['tulipindicators']}, () => {
      const fisherTransform = new FisherTransform(5);
      const offset = fisherTransform.getRequiredInputs() - 1;

      highs.forEach((high, i) => {
        const result = fisherTransform.add({high, low: lows[i]});

        if (fisherTransform.isStable) {
          expect(result?.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(fisherTransform.getRequiredInputs()).toBe(5);
      expect(fisherTransform.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BULLISH,
      });
    });

    it('stays finite in a flat market where every window is a single price', () => {
      const fisherTransform = new FisherTransform(3);
      const results: string[] = [];

      for (let i = 0; i < 5; i++) {
        const result = fisherTransform.add({high: 100, low: 90});

        if (result !== null) {
          results.push(result.toFixed(3));
        }
      }

      /*
       * A flat window reads as the bottom of a nominal range, so the transform drifts negative
       * instead of dividing by zero.
       */
      expect(results).toEqual(['-0.343', '-0.791', '-1.261']);
    });

    it('caps the transform when prices pin the top of their range for many bars', () => {
      const fisherTransform = new FisherTransform(2);

      for (let i = 0; i < 13; i++) {
        fisherTransform.add({high: i + 1.5, low: i + 0.5});
      }

      expect(fisherTransform.getResultOrThrow().toFixed(4)).toBe('6.1432');
    });

    it('caps the transform when prices pin the bottom of their range for many bars', () => {
      const fisherTransform = new FisherTransform(2);

      for (let i = 0; i < 13; i++) {
        fisherTransform.add({high: 13.5 - i, low: 12.5 - i});
      }

      expect(fisherTransform.getResultOrThrow().toFixed(4)).toBe('-6.1432');
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const fisherTransform = new FisherTransform(5);

      highs.forEach((high, i) => {
        fisherTransform.add({high, low: lows[i]});
      });

      const latestValue = {high: 1_000, low: 999} as const;
      const latestResult = '3.43';

      fisherTransform.add(latestValue);

      expect(fisherTransform.getResultOrThrow().toFixed(2)).toBe(latestResult);

      const someOtherValue = {high: 90, low: 80} as const;
      const otherResult = '1.89';

      fisherTransform.replace(someOtherValue);

      expect(fisherTransform.getResultOrThrow().toFixed(2)).toBe(otherResult);

      fisherTransform.replace(latestValue);

      expect(fisherTransform.getResultOrThrow().toFixed(2)).toBe(latestResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const fisherTransform = new FisherTransform(5);

      expect(fisherTransform.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH when the transform is above zero', () => {
      const fisherTransform = new FisherTransform(5);

      for (let i = 0; i < 5; i++) {
        fisherTransform.add({high: 100 + i, low: 90 + i});
      }

      expect(fisherTransform.getResultOrThrow()).toBeGreaterThan(0);
      expect(fisherTransform.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BULLISH,
      });
    });

    it('returns BEARISH when the transform is below zero', () => {
      const fisherTransform = new FisherTransform(5);

      for (let i = 0; i < 5; i++) {
        fisherTransform.add({high: 100 - i, low: 90 - i});
      }

      expect(fisherTransform.getResultOrThrow()).toBeLessThan(0);
      expect(fisherTransform.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });

    it('returns SIDEWAYS when a mid-range bar keeps the transform at exactly zero', () => {
      const fisherTransform = new FisherTransform(3);

      fisherTransform.add({high: 2, low: 0});
      fisherTransform.add({high: 4, low: 2});
      fisherTransform.add({high: 3, low: 1});

      expect(fisherTransform.getResultOrThrow()).toBe(0);
      expect(fisherTransform.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.SIDEWAYS,
      });
    });
  });
});

/*
 * The Fisher Transform only reads a bar's relative position inside its window, so any candle at
 * the top of the range normalizes identically — a diverging input has to sit below the range.
 */
testIndicatorContract({
  create: () => new FisherTransform(5),
  divergentInput: {high: 81, low: 80},
  inputs: [
    {high: 82.15, low: 81.29},
    {high: 81.89, low: 80.64},
    {high: 83.03, low: 81.31},
    {high: 83.3, low: 82.65},
    {high: 83.85, low: 83.07},
    {high: 83.9, low: 83.11},
  ],
});
