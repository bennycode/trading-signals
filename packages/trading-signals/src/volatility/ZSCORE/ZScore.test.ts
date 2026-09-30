import {IndicatorInputShape, TradingSignal} from '../../base/Indicator.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {ZScore} from './ZScore.js';

describe('ZScore', () => {
  describe('update', () => {
    it('scores the current input against a population it belongs to', () => {
      /*
       * Population with mean 5 and population standard deviation 2:
       * https://en.wikipedia.org/wiki/Standard_deviation#Population_standard_deviation_of_grades_of_eight_students
       */
      const population = [2, 4, 4, 4, 5, 5, 7, 9] as const;
      const zScore = new ZScore(population.length);

      for (const value of population) {
        zScore.add(value);
      }

      expect(zScore.getResultOrThrow(), 'the newest grade sits two standard deviations above the mean').toBe(2);
    });

    it('yields its first result once the window is full', () => {
      const zScore = new ZScore(3);

      expect(zScore.add(1)).toBeNull();
      expect(zScore.add(3)).toBeNull();
      expect(zScore.add(3)?.toFixed(4), 'against [1, 3, 3] including the current input').toBe('0.7071');
    });

    it('slides the window forward with every input', () => {
      const values = [10, 12, 11, 15, 9, 14, 20, 8] as const;
      const expectations = ['1.6036', '-1.2702', '0.7338', '1.4084', '-0.9972'] as const;
      const zScore = new ZScore(4);
      const offset = zScore.getRequiredInputs() - 1;

      values.forEach((value, i) => {
        const result = zScore.add(value);

        if (i < offset) {
          expect(result).toBeNull();
        } else {
          expect(result?.toFixed(4)).toBe(expectations[i - offset]);
        }
      });
    });

    it('caps a spike at the square root of one less than the period', () => {
      const zScore = new ZScore(5);

      for (const value of [0, 0, 0, 0, 1_000_000]) {
        zScore.add(value);
      }

      expect(zScore.getResultOrThrow(), 'however large the spike, it dilutes its own window').toBe(2);
    });

    it('returns null when the window has no variance', () => {
      const zScore = new ZScore(3);

      zScore.add(0.1);
      zScore.add(0.1);

      expect(zScore.add(0.1), 'floating-point noise must not fake a deviation').toBeNull();
      expect(zScore.isStable).toBe(false);
    });

    it('clears a previous result once the window loses its variance', () => {
      const zScore = new ZScore(2);

      zScore.add(1);

      expect(zScore.add(3)).toBe(1);
      expect(zScore.add(3)).toBeNull();
      expect(zScore.isStable).toBe(false);
      expect(() => zScore.getResultOrThrow()).toThrow();
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const zScore = new ZScore(2);

      zScore.add(1);

      const originalResult = zScore.add(3);
      const replacedResult = zScore.replace(0);

      expect(originalResult).toBe(1);
      expect(replacedResult).toBe(-1);

      const restoredResult = zScore.replace(3);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const zScore = new ZScore(2);

      expect(zScore.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH for an input at least two deviations above normal', () => {
      const zScore = new ZScore(5);

      for (const value of [0, 0, 0, 0, 4]) {
        zScore.add(value);
      }

      expect(zScore.getResultOrThrow(), 'the overbought threshold itself counts').toBe(2);
      expect(zScore.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH for an input at least two deviations below normal', () => {
      const zScore = new ZScore(5);

      for (const value of [4, 4, 4, 4, 0]) {
        zScore.add(value);
      }

      expect(zScore.getResultOrThrow(), 'the oversold threshold itself counts').toBe(-2);
      expect(zScore.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS for an input between the thresholds', () => {
      const zScore = new ZScore(2);

      zScore.add(1);
      zScore.add(3);

      expect(zScore.getResultOrThrow()).toBe(1);
      expect(zScore.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('respects custom overbought and oversold thresholds', () => {
      const sensitiveBull = new ZScore(2, {overbought: 1});
      const sensitiveBear = new ZScore(2, {oversold: 1});

      for (const value of [1, 3]) {
        sensitiveBull.add(value);
        sensitiveBear.add(value);
      }

      expect(sensitiveBull.getSignal().state).toBe(TradingSignal.BULLISH);
      expect(sensitiveBear.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });

  describe('inputShape', () => {
    it('reads prices unless told otherwise', () => {
      expect(new ZScore(2).inputShape).toBe(IndicatorInputShape.PRICE);
    });

    it('reads volumes when declared as a volume series', () => {
      const zScore = new ZScore(2, {inputShape: IndicatorInputShape.VOLUME});

      expect(zScore.inputShape).toBe(IndicatorInputShape.VOLUME);
    });
  });

  describe('getResultFromBatch', () => {
    it('scores the newest value of the window', () => {
      expect(ZScore.getResultFromBatch([2, 4, 4, 4, 5, 5, 7, 9]), 'the Wikipedia grades from the streaming test').toBe(
        2
      );
    });

    it('agrees with the streaming indicator', () => {
      const values = [10, 12, 11, 15] as const;
      const zScore = new ZScore(values.length);

      for (const value of values) {
        zScore.add(value);
      }

      expect(ZScore.getResultFromBatch([...values])).toBe(zScore.getResultOrThrow());
    });

    it('returns null for an empty window', () => {
      expect(ZScore.getResultFromBatch([])).toBeNull();
    });

    it('returns null for a window without variance', () => {
      expect(ZScore.getResultFromBatch([0.1, 0.1, 0.1]), 'floating-point noise must not fake a deviation').toBeNull();
    });
  });

  it('rejects a period without room for variance', () => {
    expect(() => new ZScore(1)).toThrowError('period must be >= 2, got "1"');
  });
});

testIndicatorContract({
  create: () => new ZScore(3),
  divergentInput: 1_000,
  inputs: [1, 3, 5, 5, 6],
});
