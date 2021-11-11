import {SMA} from '../SMA/SMA';
import {getFasterStandardDeviation, getStandardDeviation} from './getStandardDeviation';

describe('getStandardDeviation', () => {
  it('returns the standard deviation', () => {
    const prices = [9, 2, 5, 4, 12, 7, 8, 11, 9, 3, 7, 4, 12, 5, 4, 10, 9, 6, 9, 4];
    const std = getStandardDeviation(prices);
    expect(std.toFixed(2)).toBe('2.98');
  });

  it('can be used to calculate a "Window Rolling Standard Deviation / Standard Deviation Over Period"', () => {
    // Test data verified with:
    // https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/untest.txt#L367-L369
    const prices = [81.59, 81.06, 82.87, 83.0, 83.61];
    const average = SMA.getResultFromBatch(prices);
    const stdDev = getStandardDeviation(prices, average);
    expect(stdDev.toFixed(2)).toBe('0.95');
  });
});

describe('getFasterStandardDeviation', () => {
  it('only works with the primitive data type number', () => {
    const prices = [9, 2, 5, 4, 12, 7, 8, 11, 9, 3, 7, 4, 12, 5, 4, 10, 9, 6, 9, 4];
    const std = getFasterStandardDeviation(prices);
    expect(std.toFixed(2)).toBe('2.98');
    const fivePrices = [81.59, 81.06, 82.87, 83.0, 83.61];
    const stdDev = getStandardDeviation(fivePrices, SMA.getResultFromBatch(fivePrices));
    expect(stdDev.toFixed(2)).toBe('0.95');
  });
});
