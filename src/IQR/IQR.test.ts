import {IQR, FasterIQR} from './IQR.js';
import Big from 'big.js';

describe('IQR', () => {
  it('returns null until enough values are provided', () => {
    const iqr = new IQR(5);

    for (let i = 0; i < 4; i++) {
      const result = iqr.add(new Big(i));
      expect(result).toBeNull();
    }
  });

  describe('getResultOrThrow', () => {
    it('calculates the interquartile range (#1)', () => {
      // Test data verified with:
      // https://en.wikipedia.org/wiki/Interquartile_range#Data_set_in_a_table
      const values = [7, 7, 31, 31, 47, 75, 87, 115, 116, 119, 119, 155, 177];
      const iqr = new IQR(13);

      for (const value of values) {
        iqr.add(new Big(value));
      }

      expect(iqr.getResultOrThrow().valueOf()).toBe('88');
    });

    it('calculates the interquartile range (#2)', () => {
      // Test data verified with:
      // https://www.khanacademy.org/math/cc-sixth-grade-math/cc-6th-data-statistics/cc-6th/v/calculating-interquartile-range-iqr
      const values = [4, 4, 6, 7, 10, 11, 12, 14, 15];
      const iqr = new IQR(9);

      for (const value of values) {
        iqr.add(new Big(value));
      }

      expect(iqr.getResultOrThrow().valueOf()).toBe('8');
    });

    it('calculates the interquartile range (#3)', () => {
      // Test data verified with:
      // https://www.khanacademy.org/math/cc-sixth-grade-math/cc-6th-data-statistics/cc-6th/v/calculating-interquartile-range-iqr
      const values = [7, 9, 9, 10, 10, 10, 11, 12, 12, 14];
      const iqr = new IQR(10);

      for (const value of values) {
        iqr.add(new Big(value));
      }

      expect(iqr.getResultOrThrow().valueOf()).toBe('3');
    });
  });
});

describe('FasterIQR', () => {
  it('returns null until enough values are provided', () => {
    const iqr = new FasterIQR(5);

    for (let i = 0; i < 4; i++) {
      const result = iqr.add(i);
      expect(result).toBeNull();
    }
  });

  describe('getResultOrThrow', () => {
    it('calculates the interquartile range (#1)', () => {
      // Test data verified with:
      // https://en.wikipedia.org/wiki/Interquartile_range#Data_set_in_a_table
      const values = [7, 7, 31, 31, 47, 75, 87, 115, 116, 119, 119, 155, 177];
      const iqr = new FasterIQR(13);

      for (const value of values) {
        iqr.add(value);
      }

      expect(iqr.getResultOrThrow().valueOf()).toBe(88);
    });

    it('calculates the interquartile range (#2)', () => {
      // Test data verified with:
      // https://www.khanacademy.org/math/cc-sixth-grade-math/cc-6th-data-statistics/cc-6th/v/calculating-interquartile-range-iqr
      const values = [4, 4, 6, 7, 10, 11, 12, 14, 15];
      const iqr = new FasterIQR(9);

      for (const value of values) {
        iqr.add(value);
      }

      expect(iqr.getResultOrThrow().valueOf()).toBe(8);
    });

    it('calculates the interquartile range (#3)', () => {
      // Test data verified with:
      // https://www.khanacademy.org/math/cc-sixth-grade-math/cc-6th-data-statistics/cc-6th/v/calculating-interquartile-range-iqr
      const values = [7, 9, 9, 10, 10, 10, 11, 12, 12, 14];
      const iqr = new FasterIQR(10);

      for (const value of values) {
        iqr.add(value);
      }

      expect(iqr.getResultOrThrow().valueOf()).toBe(3);
    });
  });
});
