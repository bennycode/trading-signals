import {getMaxDrawdown} from './getMaxDrawdown.js';

describe('getMaxDrawdown', () => {
  it('reports the deepest peak-to-trough decline in percent', () => {
    const values = [100, 120, 60, 90];

    expect(getMaxDrawdown(values)).toBe(50);
  });

  it('reports zero for a series that only rises', () => {
    const values = [1, 2, 3];

    expect(getMaxDrawdown(values)).toBe(0);
  });

  it('measures declines only from a positive peak', () => {
    const values = [0, 10, 5];

    expect(getMaxDrawdown(values)).toBe(50);
  });

  it('throws an error when no values are given', () => {
    expect(() => getMaxDrawdown([])).toThrowError('Cannot calculate the maximum drawdown of an empty series.');
  });
});
