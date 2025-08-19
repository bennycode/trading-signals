import {NotEnoughDataError} from '../../error/index.js';
import {AO} from './AO.js';

describe('AO', () => {
  // Test data verified with:
  // https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/extra.txt#L17-L20
  const highs = [
    32.11, 27.62, 28.26, 28.02, 26.93, 26.65, 27.25, 27.58, 27.9, 28.9, 29.34, 29.82, 29.54, 29.3, 29.5, 29.5, 29.7,
    29.14, 27.17, 30.34, 30.26, 30.14, 29.98, 30.55, 32.11, 34.16, 39.5, 50.78, 51.38, 51.34, 50.7, 44.23, 42.71, 39.82,
    42.35, 44.71, 44.27, 43.67, 44.83, 44.55, 46.8, 46.24, 45.52, 44.55, 46.12, 44.71, 44.47, 45.28, 44.63, 43.43,
    46.24, 49.13, 49.93, 49.93, 51.38, 52.78, 50.53, 50.61, 49.33, 49.41, 53.3, 52.58, 62.3, 61.57, 62.54, 64.54, 74.14,
    73.17, 70.12, 68.64, 71.77, 70.64, 71.77, 104.04, 103.4, 97.62, 98.9, 99.46, 89.23, 87.34, 82.28, 78.99, 81.56,
    78.03, 73.86, 77.67, 79.47, 77.71, 76.75, 78.31, 77.71, 72.25, 68.08, 66.31, 65.75, 64.14, 67.43, 80.28, 78.35,
  ] as const;
  const lows = [
    25.69, 25.57, 25.73, 25.69, 25.69, 26.17, 26.05, 26.29, 26.89, 27.74, 28.46, 29.02, 28.46, 28.78, 29.06, 28.74,
    28.5, 27.01, 26.33, 26.97, 29.18, 29.62, 29.54, 29.74, 30.47, 31.83, 34.64, 40.42, 47.68, 48.97, 43.27, 41.58,
    38.73, 37.33, 37.89, 43.39, 42.67, 41.14, 42.39, 43.03, 43.75, 44.83, 43.35, 42.67, 43.67, 42.67, 43.59, 43.19,
    43.31, 41.58, 42.55, 45.96, 47.4, 48.17, 48.97, 50.25, 48.61, 48.37, 48.05, 48.05, 49.17, 50.98, 49.85, 56.56, 57.8,
    58.84, 64.54, 66.31, 63.1, 65.06, 66.95, 65.83, 67.39, 72.25, 84.13, 89.91, 93.12, 89.91, 83.17, 76.34, 72.73,
    71.93, 75.86, 72.57, 67.91, 70.04, 75.14, 74.66, 72.69, 72.89, 70.64, 63.66, 57.8, 58.92, 52.66, 57.88, 62.34,
    68.76, 67.67,
  ] as const;
  const aos = [
    11.6905, 9.3535, 8.2531, 7.8816, 7.7612, 8.2594, 8.4822, 8.1794, 8.0454, 7.9502, 7.5005, 7.251, 6.5143, 5.7713,
    5.2844, 4.9243, 4.0526, 3.7438, 3.8741, 4.1156, 4.5317, 5.4641, 6.2518, 6.0741, 5.6701, 5.0864, 4.3346, 3.862,
    4.1222, 5.2467, 7.0596, 8.9599, 10.4984, 13.1686, 14.985, 15.7149, 16.3803, 17.1528, 16.1721, 15.3763, 18.3787,
    22.3355, 25.798, 29.8361, 33.3549, 31.751, 28.244, 24.0074, 18.979, 14.7623, 11.6177, 8.6476, 7.1438, 6.6704,
    5.3673, 4.5294, 4.764, 4.1044, 1.6913, -1.3769, -4.2062, -7.7196, -10.6241, -11.4972, -9.6358, -7.9344,
  ] as const;

  describe('getResultOrThrow', () => {
    it('works with an interval setting of 5/34', () => {
      const shortInterval = 5;
      const longInterval = 34;

      const ao = new AO(shortInterval, longInterval);

      for (let i = 0; i < lows.length; i++) {
        const candle = {
          high: highs[i],
          low: lows[i],
        };
        const result = ao.add(candle);
        if (ao.isStable) {
          expect(result).not.toBeUndefined();
          const actual = ao.getResultOrThrow().toFixed(4);
          const expected = aos[i - (longInterval - 1)];
          expect(parseFloat(actual)).toBe(expected);
        }
      }

      expect(ao.getRequiredInputs()).toBe(longInterval);
    });

    it('throws an error when there is not enough input data', () => {
      const ao = new AO(5, 34);

      try {
        ao.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('replace', () => {
    it('replaces recently added values', () => {
      const shortInterval = 5;
      const longInterval = 34;

      const ao = new AO(shortInterval, longInterval);

      lows.forEach((low, index) => {
        ao.add({
          high: highs[index],
          low,
        });
      });

      // Add the latest value
      const latestValue = {
        high: 9000,
        low: 0,
      };
      const latestResult = '749.69';
      ao.add(latestValue);
      expect(ao.getResultOrThrow()?.toFixed(2)).toBe(latestResult);

      // Replace the latest value with some other value
      const someOtherValue = {
        high: 2000,
        low: -2000,
      };
      const otherResult = '-17.96';

      ao.replace(someOtherValue);
      expect(ao.getResultOrThrow()?.toFixed(2)).toBe(otherResult);

      // Replace the other value with the latest value
      ao.replace(latestValue);
      expect(ao.getResultOrThrow()?.toFixed(2)).toBe(latestResult);
    });
  });
});
