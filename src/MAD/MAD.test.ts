import {FasterMAD, MAD} from './MAD.js';
import {NotEnoughDataError} from '../error/index.js';

describe('MAD', () => {
  // Test data verified with:
  // https://tulipindicators.org/md
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ];
  const expectations = ['0.88', '0.67', '0.23', '0.39', '0.51', '0.63', '0.67', '0.83', '0.91', '1.02', '0.62'];

  describe('update', () => {
    it('can replace recently added values', () => {
      const mad = new MAD(5);
      const fasterMAD = new FasterMAD(5);
      mad.add(81.59);
      fasterMAD.add(81.59);
      mad.add(81.06);
      fasterMAD.add(81.06);
      mad.add(82.87);
      fasterMAD.add(82.87);
      mad.add(83.0);
      fasterMAD.add(83.0);
      mad.add(83.61);
      fasterMAD.add(83.61);
      mad.add(83.15);
      fasterMAD.add(83.15);
      mad.add(82.84);
      fasterMAD.add(82.84);
      mad.add(90);
      fasterMAD.add(90);
      mad.update(83.99, true);
      fasterMAD.update(83.99, true);

      expect(mad.isStable).toBe(true);
      expect(fasterMAD.isStable).toBe(true);

      expect(mad.getResult().toFixed(2)).toBe('0.39');
      expect(fasterMAD.getResult().toFixed(2)).toBe('0.39');
    });
  });

  describe('getResult', () => {
    it('calculates the absolute deviation from the mean over a period', () => {
      // Test data verified with:
      // https://en.wikipedia.org/wiki/Average_absolute_deviation#Mean_absolute_deviation_around_a_central_point
      const prices = [2, 2, 3, 4, 14];
      const mad = new MAD(5);
      const fasterMAD = new FasterMAD(5);
      for (const price of prices) {
        mad.add(price);
        fasterMAD.add(price);
      }
      const actual = mad.getResult().valueOf();
      expect(actual).toBe('3.6');
      expect(fasterMAD.getResult().valueOf()).toBe(3.6);
    });

    it('is compatible with results from Tulip Indicators (TI)', () => {
      const mad = new MAD(5);
      const fasterMAD = new FasterMAD(5);
      for (const price of prices) {
        mad.add(price);
        fasterMAD.add(price);
        if (mad.isStable && fasterMAD.isStable) {
          const expected = expectations.shift()!;
          expect(mad.getResult().toFixed(2)).toBe(expected);
          expect(fasterMAD.getResult().toFixed(2)).toBe(expected);
        }
      }
      expect(mad.getResult().toFixed(2)).toBe('0.62');
      expect(fasterMAD.getResult().toFixed(2)).toBe('0.62');
    });

    it("stores the highest and lowest result throughout the indicator's lifetime", () => {
      const mad = new MAD(5);
      const fasterMAD = new FasterMAD(5);
      for (const price of prices) {
        mad.add(price);
        fasterMAD.add(price);
      }
      expect(mad.highest!.valueOf()).toBe('1.0184');
      expect(mad.lowest!.valueOf()).toBe('0.2288');
      expect(fasterMAD.highest?.toFixed(4)).toBe('1.0184');
      expect(fasterMAD.lowest?.toFixed(4)).toBe('0.2288');
    });

    it('throws an error when there is not enough input data', () => {
      const mad = new MAD(5);
      try {
        mad.getResult();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }

      const fasterMAD = new FasterMAD(5);
      try {
        fasterMAD.getResult();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('getResultFromBatch', () => {
    it("doesn't crash when the array is empty", () => {
      const result = MAD.getResultFromBatch([]);
      expect(result.valueOf()).toBe('0');
    });

    it('calculates the mean when no mean is given', () => {
      // Test data verified with:
      // https://en.wikipedia.org/wiki/Average_absolute_deviation#Mean_absolute_deviation_around_a_central_point
      const prices = [2, 2, 3, 4, 14];
      expect(MAD.getResultFromBatch(prices).valueOf()).toBe('3.6');
      expect(FasterMAD.getResultFromBatch(prices).valueOf()).toBe(3.6);
    });

    it('accepts a supplied mean', () => {
      // Test data verified with:
      // https://en.wikipedia.org/wiki/Average_absolute_deviation#Mean_absolute_deviation_around_a_central_point
      const prices = [2, 2, 3, 4, 14];
      const mean = 5;
      expect(MAD.getResultFromBatch(prices, mean).valueOf()).toBe('3.6');
      expect(FasterMAD.getResultFromBatch(prices, mean).valueOf()).toBe(3.6);
    });
  });
});
