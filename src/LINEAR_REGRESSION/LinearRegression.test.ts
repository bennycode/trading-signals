import {LinearRegression, FasterLinearRegression} from '../index.js';
import {describe, expect, it} from 'vitest';
import Big from 'big.js';
import {NotEnoughDataError} from '../error/index.js';

describe('LinearRegression', () => {
  describe('prediction (linreg)', () => {
    it('calculates the prediction values correctly', () => {
      const period = 5;
      const prices = [10.5, 11.2, 10.3, 12.1, 11.2, 10.5, 11.1, 11.1, 10.2];
      const expected = [11.52, 10.96, 11.04, 10.78, 10.54];
      const linreg = new LinearRegression({period});

      for (let i = 0; i < prices.length; i++) {
        linreg.update(prices[i], false);
        if (i >= period - 1) {
          const result = linreg.getResultOrThrow();
          expect(result.prediction.toFixed(2)).toEqual(expected[i - period + 1].toString());
        }
      }
    });
  });

  describe('intercept (linregintercept)', () => {
    it('calculates the intercept values correctly', () => {
      const period = 5;
      const prices = [10.5, 11.2, 10.3, 12.1, 11.2, 10.5, 11.1, 11.1, 10.2];
      const expected = [10.6, 11.16, 11.04, 11.62, 11.1];
      const linreg = new LinearRegression({period});

      for (let i = 0; i < prices.length; i++) {
        linreg.update(prices[i], false);
        if (i >= period - 1) {
          const result = linreg.getResultOrThrow();
          expect(result.intercept).toEqual(new Big(expected[i - period + 1]));
        }
      }
    });
  });

  describe('slope (linregslope)', () => {
    it('calculates the slope values correctly', () => {
      const period = 5;
      const prices = [6, 7, 8, 9, 10, 11];
      const expected = [1, 1];
      const linreg = new LinearRegression({period});

      for (let i = 0; i < prices.length; i++) {
        linreg.update(prices[i], false);
        if (i >= period - 1) {
          const result = linreg.getResultOrThrow();
          expect(result.slope).toEqual(new Big(expected[i - period + 1]));
        }
      }
    });
  });

  describe('isStable', () => {
    it('returns true only when enough data is available', () => {
      const linreg = new LinearRegression({period: 5});

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
      const linreg = new LinearRegression({period: 5});
      const prices = [1, 2, 3, 4, 5];

      prices.forEach(price => linreg.update(price, false));
      const beforeReplace = linreg.getResultOrThrow();

      linreg.update(6, true);
      const afterReplace = linreg.getResultOrThrow();

      expect(beforeReplace.prediction.toString()).not.toEqual(afterReplace.prediction.toString());
    });
  });

  describe('error handling', () => {
    it('throws NotEnoughDataError when getting result without enough data', () => {
      const linreg = new LinearRegression({period: 5});
      expect(() => linreg.getResultOrThrow()).toThrow(NotEnoughDataError);
    });
  });
});

describe('FasterLinearRegression', () => {
  describe('calculations', () => {
    it('calculates regression values correctly', () => {
      const period = 5;
      const prices = [10, 11, 12, 13, 14]; // Perfect linear trend for easy verification
      const linreg = new FasterLinearRegression({period});

      prices.forEach(price => linreg.update(price, false));
      const result = linreg.getResultOrThrow();

      // For a perfect linear trend:
      expect(result.slope).toBeCloseTo(1, 6); // Should be exactly 1
      expect(result.intercept).toBeCloseTo(9, 6); // Should be exactly 9
      expect(result.prediction).toBeCloseTo(14, 6); // Should predict the last value
    });

    it('handles non-perfect linear relationships', () => {
      const period = 5;
      const prices = [10.5, 11.2, 10.3, 12.1, 11.2];
      const linreg = new FasterLinearRegression({period});

      prices.forEach(price => linreg.update(price, false));
      const result = linreg.getResultOrThrow();

      expect(result.prediction).toBeDefined();
      expect(result.slope).toBeDefined();
      expect(result.intercept).toBeDefined();
    });
  });

  describe('update with replace', () => {
    it('correctly replaces the last value', () => {
      const linreg = new FasterLinearRegression({period: 5});
      const prices = [1, 2, 3, 4, 5];

      prices.forEach(price => linreg.update(price, false));
      const beforeReplace = linreg.getResultOrThrow();

      linreg.update(6, true);
      const afterReplace = linreg.getResultOrThrow();

      expect(beforeReplace.slope).not.toEqual(afterReplace.slope);
    });
  });

  describe('isStable', () => {
    it('returns true only when enough data is available', () => {
      const linreg = new FasterLinearRegression({period: 5});

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
      const linreg = new FasterLinearRegression({period: 5});
      expect(() => linreg.getResultOrThrow()).toThrow(NotEnoughDataError);
    });

    it('returns null when updating with insufficient data', () => {
      const linreg = new FasterLinearRegression({period: 5});
      expect(linreg.update(10, false)).toBeNull();
    });
  });
});
