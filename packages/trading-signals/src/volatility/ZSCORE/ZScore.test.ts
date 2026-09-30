import {IndicatorInputShape, TradingSignal} from '../../base/Indicator.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {getZScore} from '../../util/index.js';
import {ZScore} from './ZScore.js';

describe('ZScore', () => {
  describe('update', () => {
    it('scores the current input against the population of prior inputs', () => {
      /*
       * Population with mean 5 and population standard deviation 2:
       * https://en.wikipedia.org/wiki/Standard_deviation#Population_standard_deviation_of_grades_of_eight_students
       */
      const population = [2, 4, 4, 4, 5, 5, 7, 9] as const;
      const zScore = new ZScore(population.length);

      for (const value of population) {
        zScore.add(value);
      }

      expect(zScore.add(9), 'two standard deviations above the mean').toBe(2);
      expect(zScore.replace(1), 'two standard deviations below the mean').toBe(-2);
      expect(zScore.replace(5), 'exactly on the mean').toBe(0);
    });

    it('excludes the current input from its own baseline', () => {
      const zScore = new ZScore(2);

      zScore.add(1);
      zScore.add(3);

      expect(zScore.add(3), 'against [1, 3] only, including the current input would yield 1 / sqrt(2)').toBe(1);
    });

    it('slides the baseline forward with every input', () => {
      const values = [10, 12, 11, 15, 9, 14, 20, 8] as const;
      const period = 4;
      const zScore = new ZScore(period);

      values.forEach((value, i) => {
        const result = zScore.add(value);

        if (i < period) {
          expect(result).toBeNull();
        } else {
          expect(result).toBe(getZScore(values.slice(i - period, i), value));
        }
      });
    });

    it('returns null when the prior inputs have no variance', () => {
      const zScore = new ZScore(3);

      zScore.add(0.1);
      zScore.add(0.1);
      zScore.add(0.1);

      expect(zScore.add(0.2), 'floating-point noise must not fake a deviation').toBeNull();
      expect(zScore.isStable).toBe(false);
    });

    it('clears a previous result once the prior inputs lose their variance', () => {
      const zScore = new ZScore(2);

      zScore.add(1);
      zScore.add(3);

      expect(zScore.add(5)).toBe(3);
      expect(zScore.add(5)).toBe(1);
      expect(zScore.add(5)).toBeNull();
      expect(zScore.isStable).toBe(false);
      expect(() => zScore.getResultOrThrow()).toThrow();
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const zScore = new ZScore(2);

      zScore.add(1);
      zScore.add(3);

      const originalResult = zScore.add(5);
      const replacedResult = zScore.replace(0);

      expect(originalResult).toBe(3);
      expect(replacedResult).toBe(-2);

      const restoredResult = zScore.replace(5);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const zScore = new ZScore(2);

      expect(zScore.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH for an input at least two deviations above normal', () => {
      const zScore = new ZScore(2);

      zScore.add(1);
      zScore.add(3);
      zScore.add(4);

      expect(zScore.getResultOrThrow(), 'the overbought threshold itself counts').toBe(2);
      expect(zScore.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH for an input at least two deviations below normal', () => {
      const zScore = new ZScore(2);

      zScore.add(1);
      zScore.add(3);
      zScore.add(0);

      expect(zScore.getResultOrThrow(), 'the oversold threshold itself counts').toBe(-2);
      expect(zScore.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS for an input between the thresholds', () => {
      const zScore = new ZScore(2);

      zScore.add(1);
      zScore.add(3);
      zScore.add(3);

      expect(zScore.getResultOrThrow()).toBe(1);
      expect(zScore.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('respects custom overbought and oversold thresholds', () => {
      const sensitiveBull = new ZScore(2, {overbought: 1});
      const sensitiveBear = new ZScore(2, {oversold: 1});

      for (const value of [1, 3, 3]) {
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

  it('rejects a period without room for variance', () => {
    expect(() => new ZScore(1)).toThrowError('period must be >= 2, got "1"');
  });
});

testIndicatorContract({
  create: () => new ZScore(3),
  divergentInput: 1_000,
  inputs: [1, 3, 5, 5, 6],
});
