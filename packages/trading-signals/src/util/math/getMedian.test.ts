import {getMedian} from './getMedian.js';

describe('getMedian', () => {
  it('returns the middle value for an odd number of items', () => {
    const result = getMedian([1, 3, 5]);
    expect(result).toBe(3);
  });

  it('returns the average of the two middle values for an even number of items', () => {
    const result = getMedian([1, 3, 5, 7]);
    expect(result).toBe(4);
  });

  it('works with a single element array', () => {
    const result = getMedian([42]);
    expect(result).toBe(42);
  });

  it('throws an error for an empty array', () => {
    expect(() => {
      getMedian([]);
    }).toThrow('Cannot calculate median of empty array');
  });

  it('handles decimal values correctly', () => {
    const result = getMedian([1.1, 2.2, 3.3]);
    expect(result).toBe(2.2);
  });
});
