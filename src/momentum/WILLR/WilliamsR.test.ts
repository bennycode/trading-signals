import {WilliamsR} from './WilliamsR.js';
import {StochasticOscillator} from '../STOCH/StochasticOscillator.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('WilliamsR', () => {
  describe('update', () => {
    it('calculates the Williams %R indicator', () => {
      // Test data using the same candles as StochasticOscillator tests
      const candles = [
        {close: 81.59, high: 82.15, low: 81.29},
        {close: 81.06, high: 81.89, low: 80.64},
        {close: 82.87, high: 83.03, low: 81.31},
        {close: 83.0, high: 83.3, low: 82.65},
        {close: 83.61, high: 83.85, low: 83.07},
        {close: 83.15, high: 83.9, low: 83.11},
        {close: 82.84, high: 83.33, low: 82.49},
        {close: 83.99, high: 84.3, low: 82.3},
        {close: 84.55, high: 84.84, low: 84.15},
        {close: 84.36, high: 85.0, low: 84.11},
        {close: 85.53, high: 85.9, low: 84.03},
        {close: 86.54, high: 86.58, low: 85.39},
        {close: 86.89, high: 86.98, low: 85.76},
        {close: 87.77, high: 88.0, low: 87.17},
        {close: 87.29, high: 87.87, low: 87.01},
      ] as const;

      const expectations = [
        '-7.48',
        '-23.01',
        '-40.93',
        '-15.50',
        '-11.42',
        '-23.70',
        '-10.28',
        '-0.93',
        '-3.05',
        '-5.79',
        '-17.88',
      ] as const;

      const willR = new WilliamsR(5);
      const offset = willR.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = willR.add(candle);

        if (willR.isStable && result !== null) {
          const expected = expectations[i - offset];
          expect(result.toFixed(2)).toBe(expected);
        }
      });

      expect(willR.isStable).toBe(true);
      expect(willR.getRequiredInputs()).toBe(5);
      expect(willR.getResultOrThrow().toFixed(2)).toBe('-17.88');
    });

    it('calculates Williams %R with a shorter period', () => {
      const candles = [
        {close: 81.59, high: 82.15, low: 81.29},
        {close: 81.06, high: 81.89, low: 80.64},
        {close: 82.87, high: 83.03, low: 81.31},
        {close: 83.0, high: 83.3, low: 82.65},
        {close: 83.61, high: 83.85, low: 83.07},
      ] as const;

      const willR = new WilliamsR(5);

      for (const candle of candles) {
        willR.add(candle);
      }

      expect(willR.isStable).toBe(true);
      expect(willR.getResultOrThrow().toFixed(2)).toBe('-7.48');
    });

    it('returns null until enough values are provided', () => {
      const willR = new WilliamsR(5);

      for (let i = 0; i < 4; i++) {
        const result = willR.add({close: i, high: i + 1, low: i - 1});
        expect(result).toBeNull();
      }

      expect(willR.isStable).toBe(false);
    });

    it('prevents division by zero when highest high and lowest low have the same value', () => {
      const willR = new WilliamsR(5);

      for (let i = 0; i < 4; i++) {
        willR.add({close: 100, high: 100, low: 100});
      }

      const result = willR.add({close: 100, high: 100, low: 100});
      expect(result).toBe(-100);
      expect(willR.getResultOrThrow()).toBe(-100);
    });

    it('verifies Williams %R is equivalent to inverted Stochastic %K', () => {
      // Williams %R = -100 * (Highest High - Close) / (Highest High - Lowest Low)
      // Stochastic %K = 100 * (Close - Lowest Low) / (Highest High - Lowest Low)
      // Therefore: Williams %R = Stochastic %K - 100

      const candles = [
        {close: 81.59, high: 82.15, low: 81.29},
        {close: 81.06, high: 81.89, low: 80.64},
        {close: 82.87, high: 83.03, low: 81.31},
        {close: 83.0, high: 83.3, low: 82.65},
        {close: 83.61, high: 83.85, low: 83.07},
        {close: 83.15, high: 83.9, low: 83.11},
        {close: 82.84, high: 83.33, low: 82.49},
        {close: 83.99, high: 84.3, low: 82.3},
        {close: 84.55, high: 84.84, low: 84.15},
        {close: 84.36, high: 85.0, low: 84.11},
      ] as const;

      const willR = new WilliamsR(5);
      const stoch = new StochasticOscillator(5, 1, 1);

      candles.forEach(candle => {
        const willRResult = willR.add(candle);
        const stochResult = stoch.add(candle);

        if (willRResult !== null && stochResult !== null) {
          const willRValue = willRResult;
          const stochKValue = stochResult.stochK;
          const difference = Math.abs(willRValue - (stochKValue - 100));
          expect(difference).toBeLessThan(0.01);
        }
      });

      expect(willR.isStable).toBe(true);
      expect(stoch.isStable).toBe(true);

      const willRValue = willR.getResultOrThrow();
      const stochKValue = stoch.getResultOrThrow().stochK;
      expect(willRValue.toFixed(2)).toBe((stochKValue - 100).toFixed(2));
    });

    it('handles the replace parameter correctly', () => {
      const willR = new WilliamsR(3);

      willR.add({close: 10, high: 11, low: 9});
      willR.add({close: 11, high: 12, low: 10});
      const result1 = willR.add({close: 12, high: 13, low: 11});

      const result2 = willR.replace({close: 11.5, high: 12.5, low: 10.5});

      expect(result1).not.toBe(result2);
      expect(willR.candles.length).toBe(3);
    });
  });

  describe('getResultOrThrow', () => {
    it('throws an error when there is not enough input data', () => {
      const willR = new WilliamsR(14);

      for (let i = 0; i < 13; i++) {
        willR.add({close: i, high: i + 1, low: i - 1});
      }

      try {
        willR.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
