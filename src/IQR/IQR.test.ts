import {IQR} from './IQR.js';

describe('IQR', () => {
  describe('add', () => {
    it('returns null until enough values are provided', () => {
      const iqr = new IQR(5);

      for (let i = 0; i < 4; i++) {
        const result = iqr.add(i);
        expect(result).toBeNull();
      }
    });

    it('keeps the interval length of values when adding more', () => {
      const iqr = new IQR(3);

      // Fill the buffer with initial values
      iqr.add(1);
      iqr.add(2);
      iqr.add(3);

      // When we add the 4th value, the 1st value should be removed
      iqr.add(4);

      // Window now contains [2, 3, 4]
      // Q1 = 2, Q3 = 4, IQR = 2
      expect(iqr.getResultOrThrow()).toBe(2);

      // When we add the 5th value, the 2nd value should be removed
      iqr.add(5);

      // Window now contains [3, 4, 5]
      // Q1 = 3, Q3 = 5, IQR = 2
      expect(iqr.getResultOrThrow()).toBe(2);
    });
  });

  describe('replace', () => {
    it('replaces the last value and recalculates the result', () => {
      const iqr = new IQR(5);
      const prices = [1, 2, 3, 4, 5] as const;

      for (const price of prices) {
        iqr.add(price);
      }

      expect(iqr.getResultOrThrow()).toBe(3);

      const result = iqr.replace(10);

      expect(result).toBe(5.5);
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the interquartile range (#1)', () => {
      // Test data verified with:
      // https://en.wikipedia.org/wiki/Interquartile_range#Data_set_in_a_table
      const prices = [7, 7, 31, 31, 47, 75, 87, 115, 116, 119, 119, 155, 177] as const;
      const interval = 13;
      const iqr = new IQR(13);
      expect(iqr.getRequiredInputs()).toBe(interval);

      for (const price of prices) {
        iqr.add(price);
      }

      expect(iqr.getResultOrThrow()).toBe(88);
    });

    it('calculates the interquartile range (#2)', () => {
      // Test data verified with:
      // https://www.khanacademy.org/math/cc-sixth-grade-math/cc-6th-data-statistics/cc-6th/v/calculating-interquartile-range-iqr
      const prices = [4, 4, 6, 7, 10, 11, 12, 14, 15] as const;
      const iqr = new IQR(9);

      for (const price of prices) {
        iqr.add(price);
      }

      expect(iqr.getResultOrThrow()).toBe(8);
    });

    it('calculates the interquartile range (#3)', () => {
      // Test data verified with:
      // https://www.khanacademy.org/math/cc-sixth-grade-math/cc-6th-data-statistics/cc-6th/v/calculating-interquartile-range-iqr
      const prices = [7, 9, 9, 10, 10, 10, 11, 12, 12, 14] as const;
      const iqr = new IQR(10);

      for (const price of prices) {
        iqr.add(price);
      }

      expect(iqr.getResultOrThrow()).toBe(3);
    });
  });
});
