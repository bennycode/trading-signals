import {fasterGetAverage, getAverage} from './getAverage';

describe('getAverage', () => {
  it('does not fail when entering an empty array', () => {
    const average = getAverage([]);
    expect(average.valueOf()).toBe('0');
  });

  it('returns the average of all given prices', () => {
    const prices = [20, 30, 40];

    const average = getAverage(prices);
    expect(average.valueOf()).toBe('30');
  });
});

describe('fasterGetAverage', () => {
  it('only works with the primitive data type number', () => {
    const prices = [20, 30, 40];

    const average = fasterGetAverage(prices);
    expect(average).toBe(30);
  });
});
