import {getTrueRange} from './getTrueRange.js';

describe('getTrueRange', () => {
  it('widens the candle range by the gap from the previous close', {tags: ['tulipindicators']}, () => {
    /*
     * Test data verified with:
     * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L412-L416
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
      '0.860',
      '1.250',
      '1.970',
      '0.650',
      '0.850',
      '0.790',
      '0.840',
      '2.000',
      '0.850',
      '0.890',
      '1.870',
      '1.190',
      '1.220',
      '1.110',
      '0.860',
    ] as const;

    highs.forEach((high, index) => {
      const candle = {close: closes[index], high, low: lows[index]};
      const previousClose = index > 0 ? closes[index - 1] : undefined;
      expect(getTrueRange(candle, previousClose).toFixed(3)).toBe(expected[index]);
    });
  });

  it('reports the raw range when a gap dwarfs the candle body', () => {
    const candle = {close: 90, high: 91, low: 89} as const;

    expect(getTrueRange(candle)).toBe(2);
    expect(getTrueRange(candle, 100)).toBe(11);
    expect(getTrueRange(candle, 80)).toBe(11);
  });
});
