import Big from 'big.js';
import {getMedian, getFasterMedian} from './getMedian.js';

describe('getMedian', () => {
  it('returns the middle value for an odd number of items', () => {
    const values = [new Big(1), new Big(3), new Big(5)];

    const result = getMedian(values);

    expect(result.valueOf()).toBe('3');
  });

  it('returns the average of the two middle values for an even number of items', () => {
    const values = [new Big(1), new Big(3), new Big(5), new Big(7)];

    const result = getMedian(values);

    expect(result.valueOf()).toBe('4');
  });

  it('works with a single element array', () => {
    const values = [new Big(42)];

    const result = getMedian(values);

    expect(result.valueOf()).toBe('42');
  });

  it('throws an error for an empty array', () => {
    expect(() => {
      getMedian([]);
    }).toThrow('Cannot calculate median of empty array');
  });

  it('handles decimal values correctly', () => {
    const values = [new Big('1.1'), new Big('2.2'), new Big('3.3')];

    const result = getMedian(values);

    expect(result.valueOf()).toBe('2.2');
  });
});

describe('getFasterMedian', () => {
  it('returns the middle value for an odd number of items', () => {
    const values = [1, 3, 5];

    const result = getFasterMedian(values);

    expect(result).toBe(3);
  });

  it('returns the average of the two middle values for an even number of items', () => {
    const values = [1, 3, 5, 7];

    const result = getFasterMedian(values);

    expect(result).toBe(4);
  });

  it('works with a single element array', () => {
    const values = [42];

    const result = getFasterMedian(values);

    expect(result).toBe(42);
  });

  it('throws an error for an empty array', () => {
    expect(() => {
      getFasterMedian([]);
    }).toThrow('Cannot calculate median of empty array');
  });

  it('handles decimal values correctly', () => {
    const values = [1.1, 2.2, 3.3];

    const result = getFasterMedian(values);

    expect(result).toBe(2.2);
  });
});
