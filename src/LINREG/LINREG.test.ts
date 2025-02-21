import {LINREG, FasterLINREG, NotEnoughDataError} from '../index.js';
import {describe} from 'vitest';

describe('LINREG', () => {
  // Test data with known regression values
  // Simple linear trend: y = 2x + 1 with some noise
  const prices = [1.1, 2.9, 5.1, 7.2, 8.8, 10.9, 13.2, 14.8, 17.1, 19.0];

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 5;
      const linreg = new LINREG({period: interval});
      const linregWithReplace = new LINREG({period: interval});

      const subset = [prices[0], prices[1], prices[2], prices[3]];

      linreg.updates([...subset, prices[4]], false);

      linregWithReplace.updates([...subset, 999], false);
      linregWithReplace.replace(prices[4]);

      const actual = linregWithReplace.getResultOrThrow().slope.toFixed(4);
      const expected = linreg.getResultOrThrow().slope.toFixed(4);

      expect(actual).toBe(expected);
    });

    it('handles replace when no data needs replacing', () => {
      const linreg = new LINREG({period: 5});
      const fasterLinreg = new FasterLINREG({period: 5});

      linreg.update(prices[0], true);
      fasterLinreg.update(prices[0], true);

      expect(linreg.prices.length).toBe(1);
      expect(fasterLinreg.prices.length).toBe(1);
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates linear regression parameters correctly', () => {
      const interval = 5;
      const linreg = new LINREG({period: interval});
      const fasterLinreg = new FasterLINREG({period: interval});

      // Add first 5 prices
      for (let i = 0; i < interval; i++) {
        linreg.add(prices[i]);
        fasterLinreg.add(prices[i]);
      }

      const result = linreg.getResultOrThrow();
      const fasterResult = fasterLinreg.getResultOrThrow();

      // Verify core parameters
      expect(result.slope.toFixed(4)).toBe('1.9700');
      expect(fasterResult.slope.toFixed(4)).toBe('1.9700');

      expect(result.intercept.toFixed(4)).toBe('1.0800');
      expect(fasterResult.intercept.toFixed(4)).toBe('1.0800');

      expect(result.rSquared.toFixed(4)).toBe('0.9975');
      expect(fasterResult.rSquared.toFixed(4)).toBe('0.9975');

      // Verify statistical parameters
      expect(result.standardError.toFixed(4)).toBe('0.1817');
      expect(fasterResult.standardError.toFixed(4)).toBe('0.1817');

      // Verify confidence intervals
      expect(result.confidenceInterval.slope[0].toFixed(4)).toBe('1.9186');
      expect(result.confidenceInterval.slope[1].toFixed(4)).toBe('2.0214');
      expect(fasterResult.confidenceInterval.slope[0].toFixed(4)).toBe('1.9186');
      expect(fasterResult.confidenceInterval.slope[1].toFixed(4)).toBe('2.0214');
    });

    it('updates results correctly with new data points', () => {
      const linreg = new LINREG({period: 5});
      const fasterLinreg = new FasterLINREG({period: 5});

      // Initial data
      for (let i = 0; i < 5; i++) {
        linreg.add(prices[i]);
        fasterLinreg.add(prices[i]);
      }

      const initialSlope = linreg.getResultOrThrow().slope;
      const initialFasterSlope = fasterLinreg.getResultOrThrow().slope;

      // Add next data point
      linreg.add(prices[5] + 1); // Add a slightly different value
      fasterLinreg.add(prices[5] + 1); // Add a slightly different value

      const updatedSlope = linreg.getResultOrThrow().slope;
      const updatedFasterSlope = fasterLinreg.getResultOrThrow().slope;

      expect(updatedSlope.toFixed(4)).not.toBe(initialSlope.toFixed(4));
      expect(updatedFasterSlope.toFixed(4)).not.toBe(initialFasterSlope.toFixed(4));
    });

    it('throws an error when there is not enough input data', () => {
      const linreg = new LINREG({period: 5});
      const fasterLinreg = new FasterLINREG({period: 5});

      try {
        linreg.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }

      try {
        fasterLinreg.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('handles update with replace flag', () => {
      const linreg = new LINREG({period: 5});
      const fasterLinreg = new FasterLINREG({period: 5});

      // Add initial data
      for (let i = 0; i < 5; i++) {
        linreg.add(prices[i]);
        fasterLinreg.add(prices[i]);
      }

      const initialResult = linreg.getResultOrThrow();
      const initialFasterResult = fasterLinreg.getResultOrThrow();

      // Replace last value
      linreg.update(100, true);
      fasterLinreg.update(100, true);

      const replacedResult = linreg.getResultOrThrow();
      const replacedFasterResult = fasterLinreg.getResultOrThrow();

      expect(replacedResult.slope.toFixed(4)).not.toBe(initialResult.slope.toFixed(4));
      expect(replacedFasterResult.slope.toFixed(4)).not.toBe(initialFasterResult.slope.toFixed(4));
    });
  });

  describe('isStable', () => {
    it('returns true only when enough data is available', () => {
      const linreg = new LINREG({period: 5});
      const fasterLinreg = new FasterLINREG({period: 5});

      expect(linreg.isStable).toBe(false);
      expect(fasterLinreg.isStable).toBe(false);

      // Add data points until we reach the required period
      for (let i = 0; i < 5; i++) {
        linreg.add(prices[i]);
        fasterLinreg.add(prices[i]);
      }

      expect(linreg.isStable).toBe(true);
      expect(fasterLinreg.isStable).toBe(true);
    });
  });
});
