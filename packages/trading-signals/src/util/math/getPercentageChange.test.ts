import {getPercentageChange} from './getPercentageChange.js';

describe('getPercentageChange', () => {
  it('returns the positive percentage change for an increase', () => {
    expect(getPercentageChange(100, 125)).toBe(25);
  });

  it('returns the negative percentage change for a decrease', () => {
    expect(getPercentageChange(100, 75)).toBe(-25);
  });

  it('returns 0 when the value did not change', () => {
    expect(getPercentageChange(50, 50)).toBe(0);
  });

  it('throws when the base value is "0"', () => {
    expect(() => getPercentageChange(0, 10)).toThrow('Cannot calculate percentage change from a base value of "0".');
  });
});
