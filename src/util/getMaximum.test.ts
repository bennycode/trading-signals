import {getMaximum} from './getMaximum';

describe('getMaximum', () => {
  it('returns the highest from all given values', () => {
    const maximum = getMaximum([4, 5, 1, 9, 7, 8]);
    expect(maximum.valueOf()).toBe('9');
  });
});
