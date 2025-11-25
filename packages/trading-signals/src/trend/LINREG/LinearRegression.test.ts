import {LinearRegression} from '../../index.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('LinearRegression', () => {
  describe('intercept (linregintercept)', () => {
    it('calculates the intercept values correctly', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L226
      const period = 5;
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const expected = [
        '81.230',
        '81.754',
        '83.076',
        '83.076',
        '83.084',
        '82.952',
        '83.104',
        '83.778',
        '84.202',
        '84.582',
        '85.854',
      ] as const;

      const linreg = new LinearRegression(period);
      expect(linreg.getRequiredInputs()).toBe(period);

      const offset = period - 1;

      prices.forEach((price, index) => {
        linreg.add(price);
        if (index >= offset) {
          const result = linreg.getResultOrThrow();
          expect(result.intercept.toFixed(3)).toBe(expected[index - offset]);
        }
      });
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates regression values correctly', () => {
      const prices = [10, 11, 12, 13, 14] as const;
      const linreg = new LinearRegression(prices.length);

      prices.forEach(price => linreg.add(price));
      const result = linreg.getResultOrThrow();

      expect(result.slope).toBe(1);
      expect(result.intercept).toBe(9);
      expect(result.prediction).toBe(14);
    });

    it('handles non-perfect linear relationships', () => {
      const prices = [10.5, 11.2, 10.3, 12.1, 11.2] as const;
      const linreg = new LinearRegression(prices.length);

      prices.forEach(price => linreg.add(price));
      const result = linreg.getResultOrThrow();

      expect(result.prediction).toBeDefined();
      expect(result.slope).toBeDefined();
      expect(result.intercept).toBeDefined();
    });
  });

  describe('replace', () => {
    it('correctly replaces the last value', () => {
      const prices = [1, 2, 3, 4, 5] as const;
      const linreg = new LinearRegression(prices.length);

      prices.forEach(price => linreg.add(price));
      const beforeReplace = linreg.getResultOrThrow();

      linreg.replace(6);
      const afterReplace = linreg.getResultOrThrow();

      expect(beforeReplace.slope).not.toEqual(afterReplace.slope);
    });
  });

  describe('isStable', () => {
    it('returns true only when enough data is available', () => {
      const linreg = new LinearRegression(5);
      expect(linreg.isStable).toEqual(false);

      linreg.add(1);
      linreg.add(2);
      linreg.add(3);
      linreg.add(4);
      expect(linreg.isStable).toEqual(false);

      linreg.add(5);
      expect(linreg.isStable).toEqual(true);
    });
  });

  describe('error handling', () => {
    it('throws NotEnoughDataError when getting result without enough data', () => {
      const linreg = new LinearRegression(5);
      expect(() => linreg.getResultOrThrow()).toThrow(NotEnoughDataError);
    });

    it('returns null when updating with insufficient data', () => {
      const linreg = new LinearRegression(5);
      expect(linreg.add(10)).toBeNull();
    });
  });
});
