import {LinearRegression, FasterLinearRegression} from '../index.js';
import {describe, expect, it} from 'vitest';
import {NotEnoughDataError} from '../error/index.js';

describe('LinearRegression', () => {
  describe('prediction (linreg)', () => {
    it('calculates the prediction values correctly', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L222
      const period = 5;
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const expected = [83.622, 83.722, 83.112, 83.56, 84.172, 84.604, 85.404, 86.21, 86.946, 87.854, 87.754] as const;
      const linreg = new LinearRegression(period);

      for (let i = 0; i < prices.length; i++) {
        linreg.update(prices[i], false);
        if (i >= period - 1) {
          const result = linreg.getResultOrThrow();
          expect(Number(result.prediction.toFixed(3))).toBeCloseTo(expected[i - period + 1], 3);
        }
      }
    });
  });

  describe('intercept (linregintercept)', () => {
    it('calculates the intercept values correctly', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L226
      const period = 5;
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const expected = [81.23, 81.754, 83.076, 83.076, 83.084, 82.952, 83.104, 83.778, 84.202, 84.582, 85.854] as const;
      const linreg = new LinearRegression(period);
      expect(linreg.getRequiredInputs()).toBe(period);

      for (let i = 0; i < prices.length; i++) {
        linreg.update(prices[i], false);
        if (i >= period - 1) {
          const result = linreg.getResultOrThrow();
          expect(Number(result.intercept.toFixed(3))).toBeCloseTo(expected[i - period + 1], 3);
        }
      }
    });
  });

  describe('slope (linregslope)', () => {
    it('calculates the slope values correctly', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L230
      const period = 5;
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const expected = [0.598, 0.492, 0.009, 0.121, 0.272, 0.413, 0.575, 0.608, 0.686, 0.818, 0.475] as const;
      const linreg = new LinearRegression(period);

      for (let i = 0; i < prices.length; i++) {
        linreg.update(prices[i], false);
        if (i >= period - 1) {
          const result = linreg.getResultOrThrow();
          expect(Number(result.slope.toFixed(3))).toBeCloseTo(expected[i - period + 1], 3);
        }
      }
    });
  });

  describe('isStable', () => {
    it('returns true only when enough data is available', () => {
      const linreg = new LinearRegression(5);

      expect(linreg.isStable).toEqual(false);

      linreg.update(1, false);
      linreg.update(2, false);
      linreg.update(3, false);
      linreg.update(4, false);

      expect(linreg.isStable).toEqual(false);

      linreg.update(5, false);

      expect(linreg.isStable).toEqual(true);
    });
  });

  describe('update with replace', () => {
    it('correctly replaces the last value', () => {
      const linreg = new LinearRegression(5);
      const prices = [1, 2, 3, 4, 5] as const;

      prices.forEach(price => linreg.update(price, false));
      const beforeReplace = linreg.getResultOrThrow();

      linreg.update(6, true);
      const afterReplace = linreg.getResultOrThrow();

      expect(beforeReplace.prediction.toString()).not.toEqual(afterReplace.prediction.toString());
    });
  });

  describe('error handling', () => {
    it('throws NotEnoughDataError when getting result without enough data', () => {
      const linreg = new LinearRegression(5);
      expect(() => linreg.getResultOrThrow()).toThrow(NotEnoughDataError);
    });
  });
});

describe('FasterLinearRegression', () => {
  describe('calculations', () => {
    it('calculates regression values correctly', () => {
      const period = 5;
      const prices = [10, 11, 12, 13, 14] as const; // Perfect linear trend for easy verification
      const linreg = new FasterLinearRegression(period);

      prices.forEach(price => linreg.update(price, false));
      const result = linreg.getResultOrThrow();

      // For a perfect linear trend:
      expect(result.slope).toBeCloseTo(1, 6); // Should be exactly 1
      expect(result.intercept).toBeCloseTo(9, 6); // Should be exactly 9
      expect(result.prediction).toBeCloseTo(14, 6); // Should predict the last value
    });

    it('handles non-perfect linear relationships', () => {
      const period = 5;
      const prices = [10.5, 11.2, 10.3, 12.1, 11.2] as const;
      const linreg = new FasterLinearRegression(period);

      prices.forEach(price => linreg.update(price, false));
      const result = linreg.getResultOrThrow();

      expect(result.prediction).toBeDefined();
      expect(result.slope).toBeDefined();
      expect(result.intercept).toBeDefined();
    });
  });

  describe('update with replace', () => {
    it('correctly replaces the last value', () => {
      const linreg = new FasterLinearRegression(5);
      const prices = [1, 2, 3, 4, 5] as const;

      prices.forEach(price => linreg.update(price, false));
      const beforeReplace = linreg.getResultOrThrow();

      linreg.update(6, true);
      const afterReplace = linreg.getResultOrThrow();

      expect(beforeReplace.slope).not.toEqual(afterReplace.slope);
    });
  });

  describe('isStable', () => {
    it('returns true only when enough data is available', () => {
      const linreg = new FasterLinearRegression(5);

      expect(linreg.isStable).toEqual(false);

      linreg.update(1, false);
      linreg.update(2, false);
      linreg.update(3, false);
      linreg.update(4, false);

      expect(linreg.isStable).toEqual(false);

      linreg.update(5, false);

      expect(linreg.isStable).toEqual(true);
    });
  });

  describe('error handling', () => {
    it('throws NotEnoughDataError when getting result without enough data', () => {
      const linreg = new FasterLinearRegression(5);
      expect(() => linreg.getResultOrThrow()).toThrow(NotEnoughDataError);
    });

    it('returns null when updating with insufficient data', () => {
      const linreg = new FasterLinearRegression(5);
      expect(linreg.update(10, false)).toBeNull();
    });
  });
});
