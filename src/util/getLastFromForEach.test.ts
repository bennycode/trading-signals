import {getLastFromForEach} from './getLastFromForEach.js';

describe('getLastFromForEach', () => {
  it('returns the last value from an forEach execution', () => {
    const array = [1, 2, 3, 4];
    const result = getLastFromForEach(array, value => value * 2);
    expect(result).toBe(8);
  });
});
