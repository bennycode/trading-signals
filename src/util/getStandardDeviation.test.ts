import {getFasterAverage} from './getAverage.js';
import {getFasterStandardDeviation, getStandardDeviation} from './getStandardDeviation.js';

describe('getFasterStandardDeviation', () => {
  it('only works with the primitive data type number', () => {
    const prices = [9, 2, 5, 4, 12, 7, 8, 11, 9, 3, 7, 4, 12, 5, 4, 10, 9, 6, 9, 4];
    const std = getFasterStandardDeviation(prices);
    expect(std.toFixed(2)).toBe('2.98');

    const fivePrices = [81.59, 81.06, 82.87, 83.0, 83.61];
    const stdDev = getStandardDeviation(fivePrices, getFasterAverage(fivePrices));
    expect(stdDev.toFixed(2)).toBe('0.95');
  });
});
