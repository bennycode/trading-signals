import {getZScore} from './getZScore.js';

describe('getZScore', () => {
  it('scores an explicitly given value against the window', () => {
    const values = [1, 2, 3, 4, 5] as const;

    // Mean is 3, population standard deviation is sqrt(2), so the z-score of 4 is 1/sqrt(2).
    expect(getZScore([...values], 4).toFixed(4)).toBe('0.7071');
  });

  it('scores the newest value of the window when no value is given', () => {
    const values = [1, 2, 3, 4, 5] as const;

    // Mean is 3, population standard deviation is sqrt(2), so the z-score of 5 is 2/sqrt(2).
    expect(getZScore([...values]).toFixed(4)).toBe('1.4142');
  });

  it('throws when the window has no variance', () => {
    expect(() => getZScore([5, 5, 5])).toThrowError('Cannot calculate the z-score of a window without variance.');
  });
});
