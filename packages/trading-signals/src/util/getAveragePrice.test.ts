import {getAveragePrice} from './getAveragePrice.js';

describe('getAveragePrice', () => {
  it('averages all four candle marks', {tags: ['tulipindicators']}, () => {
    /*
     * Test data verified with:
     * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L79-L84
     *
     * Three values differ in their last digit: those candles' average prices land exactly half-way
     * (83.3925, 83.3225 and 87.4425), which Tulip's reference rounds down while the doubles here
     * sit a hair above the midpoint and round up — the same prices, ties broken differently.
     */
    const opens = [
      81.85, 81.2, 81.55, 82.91, 83.1, 83.41, 82.71, 82.7, 84.2, 84.25, 84.03, 85.45, 86.18, 88.0, 87.6,
    ] as const;
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
      '81.720',
      '81.198',
      '82.190',
      '82.965',
      '83.407',
      '83.393',
      '82.843',
      '83.323',
      '84.435',
      '84.430',
      '84.873',
      '85.990',
      '86.453',
      '87.735',
      '87.443',
    ] as const;

    opens.forEach((open, index) => {
      const candle = {close: closes[index], high: highs[index], low: lows[index], open};
      expect(getAveragePrice(candle).toFixed(3)).toBe(expected[index]);
    });
  });
});
