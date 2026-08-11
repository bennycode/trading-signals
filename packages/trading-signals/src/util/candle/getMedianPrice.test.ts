import {getMedianPrice} from './getMedianPrice.js';

describe('getMedianPrice', () => {
  it('returns the midpoint of the candle range', {tags: ['tulipindicators']}, () => {
    /*
     * Test data verified with:
     * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L267-L270
     */
    const highs = [
      82.15, 81.89, 83.03, 83.3, 83.85, 83.9, 83.33, 84.3, 84.84, 85.0, 85.9, 86.58, 86.98, 88.0, 87.87,
    ] as const;
    const lows = [
      81.29, 80.64, 81.31, 82.65, 83.07, 83.11, 82.49, 82.3, 84.15, 84.11, 84.03, 85.39, 85.76, 87.17, 87.01,
    ] as const;
    const expected = [
      '81.720',
      '81.265',
      '82.170',
      '82.975',
      '83.460',
      '83.505',
      '82.910',
      '83.300',
      '84.495',
      '84.555',
      '84.965',
      '85.985',
      '86.370',
      '87.585',
      '87.440',
    ] as const;

    highs.forEach((high, index) => {
      expect(getMedianPrice({high, low: lows[index]}).toFixed(3)).toBe(expected[index]);
    });
  });
});
