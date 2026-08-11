import {getCorrelation} from './getCorrelation.js';

describe('getCorrelation', () => {
  it('returns 1 for perfectly correlated series', () => {
    const valuesA = [1, 2, 3] as const;
    const valuesB = [2, 4, 6] as const;

    expect(getCorrelation([...valuesA], [...valuesB])).toBe(1);
  });

  it('returns -1 for perfectly inverted series', () => {
    const valuesA = [1, 2, 3] as const;
    const valuesB = [6, 4, 2] as const;

    expect(getCorrelation([...valuesA], [...valuesB])).toBe(-1);
  });

  it('throws when the series differ in length', () => {
    expect(() => getCorrelation([1, 2, 3], [1, 2])).toThrowError(
      'The series have to be of equal length, but "3" and "2" were given.'
    );
  });

  it('throws when fewer than 2 pairs are given', () => {
    expect(() => getCorrelation([1], [1])).toThrowError(
      'The correlation has to be taken over at least 2 pairs, but "1" was given.'
    );
  });

  it('throws when one of the series has no variance', () => {
    expect(() => getCorrelation([1, 1, 1], [1, 2, 3])).toThrowError('Cannot correlate a series without variance.');
  });
});
