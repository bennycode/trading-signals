import {FasterSMA} from './FasterSMA';

describe('FasterSMA', () => {
  describe('getResult', () => {
    it('calculates the moving average based on the last 5 inputs', () => {
      // Test data taken from:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/untest.txt#L359-L361
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ];
      const expectations = [
        '82.426',
        '82.738',
        '83.094',
        '83.318',
        '83.628',
        '83.778',
        '84.254',
        '84.994',
        '85.574',
        '86.218',
        '86.804',
      ];
      const sma = new FasterSMA(5);
      for (const price of prices) {
        const actual = sma.update(price);
        if (actual) {
          const expected = expectations.shift()!;
          expect(actual.toFixed(3)).toBe(expected);
        }
      }
    });
  });
});
