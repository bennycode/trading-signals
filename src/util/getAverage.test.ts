import {getFasterAverage} from './getAverage.js';

describe('getFasterAverage', () => {
  it('does not fail when entering an empty array', () => {
    const average = getFasterAverage([]);
    expect(average).toBe(0);
  });

  it('only works with the primitive data type number', () => {
    const prices = [20, 30, 40];
    const average = getFasterAverage(prices);
    expect(average).toBe(30);
  });
});
