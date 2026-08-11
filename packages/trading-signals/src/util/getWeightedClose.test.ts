import {getWeightedClose} from './getWeightedClose.js';

describe('getWeightedClose', () => {
  it('leans the candle price toward the close', {tags: ['tulipindicators']}, () => {
    /*
     * Test data verified with:
     * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L477-L481
     *
     * Two values differ in their last digit: those candles' weighted closes land exactly half-way
     * (84.4575 and 87.6775), which Tulip's reference rounds down while the doubles here sit a hair
     * above the midpoint and round up — the same prices, ties broken differently.
     */
    const highs = [
      82.15, 81.89, 83.03, 83.3, 83.85, 83.9, 83.33, 84.3, 84.84, 85.0, 85.9, 86.58, 86.98, 88.0, 87.87,
    ] as const;
    const lows = [
      81.29, 80.64, 81.31, 82.65, 83.07, 83.11, 82.49, 82.3, 84.15, 84.11, 84.03, 85.39, 85.76, 87.17, 87.01,
    ] as const;
    const closes = [
      81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
    ] as const;
    const expected = [
      '81.655',
      '81.162',
      '82.520',
      '82.987',
      '83.535',
      '83.328',
      '82.875',
      '83.645',
      '84.523',
      '84.458',
      '85.248',
      '86.263',
      '86.630',
      '87.678',
      '87.365',
    ] as const;

    highs.forEach((high, index) => {
      expect(getWeightedClose({close: closes[index], high, low: lows[index]}).toFixed(3)).toBe(expected[index]);
    });
  });
});
