import {getMinimum} from './getMinimum.js';

describe('getMinimum', () => {
  it('returns the lowest from all given values', () => {
    const minimum = getMinimum([4, 5, 1, 9, 7, 8]);
    expect(minimum).toBe(1);
  });
});
