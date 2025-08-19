import {MAD} from './MAD.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('MAD', () => {
  // Test data verified with:
  // https://tulipindicators.org/md
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expectations = [
    '0.88',
    '0.67',
    '0.23',
    '0.39',
    '0.51',
    '0.63',
    '0.67',
    '0.83',
    '0.91',
    '1.02',
    '0.62',
  ] as const;

  describe('update', () => {
    it('can replace recently added values', () => {
      const mad = new MAD(5);

      mad.add(81.59);
      mad.add(81.06);
      mad.add(82.87);
      mad.add(83.0);
      mad.add(83.61);
      mad.add(83.15);
      mad.add(82.84);
      mad.add(90);
      mad.replace(83.99);

      expect(mad.isStable).toBe(true);
      expect(mad.getResultOrThrow().toFixed(2)).toBe('0.39');
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the absolute deviation from the mean over a period', () => {
      // Test data verified with:
      // https://en.wikipedia.org/wiki/Average_absolute_deviation#Mean_absolute_deviation_around_a_central_point
      const prices = [2, 2, 3, 4, 14];
      const mad = new MAD(5);

      for (const price of prices) {
        mad.add(price);
      }

      expect(mad.getResultOrThrow()).toBe(3.6);
    });

    it('is compatible with results from Tulip Indicators (TI)', () => {
      const mad = new MAD(5);
      const offset = mad.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        mad.add(price);
        if (mad.isStable) {
          const expected = expectations[i - offset];
          expect(mad.getResultOrThrow().toFixed(2)).toBe(expected);
        }
      });

      expect(mad.getResultOrThrow().toFixed(2)).toBe('0.62');
    });

    it('produces consistent results over the indicator lifetime', () => {
      const mad = new MAD(5);
      for (const price of prices) {
        mad.add(price);
      }
      expect(mad.getResultOrThrow().toFixed(2)).toBe('0.62');
    });

    it('throws an error when there is not enough input data', () => {
      const mad = new MAD(5);
      try {
        mad.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('getResultFromBatch', () => {
    it("doesn't crash when the array is empty", () => {
      const result = MAD.getResultFromBatch([]);
      expect(result).toBe(0);
    });

    it('calculates the mean when no mean is given', () => {
      // Test data verified with:
      // https://en.wikipedia.org/wiki/Average_absolute_deviation#Mean_absolute_deviation_around_a_central_point
      const prices = [2, 2, 3, 4, 14];
      expect(MAD.getResultFromBatch(prices)).toBe(3.6);
    });

    it('accepts a supplied mean', () => {
      // Test data verified with:
      // https://en.wikipedia.org/wiki/Average_absolute_deviation#Mean_absolute_deviation_around_a_central_point
      const prices = [2, 2, 3, 4, 14];
      const mean = 5;
      expect(MAD.getResultFromBatch(prices, mean)).toBe(3.6);
    });
  });
});
