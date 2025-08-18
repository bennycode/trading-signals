import {getAverage} from './getAverage.js';

describe('getAverage', () => {
  it('does not fail when entering an empty array', () => {
    const average = getAverage([]);
    expect(average).toBe(0);
  });

  it('only works with the primitive data type number', () => {
    const prices = [20, 30, 40];
    const average = getAverage(prices);
    expect(average).toBe(30);
  });
});
