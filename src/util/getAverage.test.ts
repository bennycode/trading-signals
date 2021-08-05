import {getAverage} from './getAverage';

describe('getAverage', () => {
  it('does not fail when entering an empty array', () => {
    const average = getAverage([]);
    expect(average.valueOf()).toBe('0');
  });
});
