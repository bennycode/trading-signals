import {getShare} from './getShare.js';

describe('getShare', () => {
  it('returns the percentage share of an amount within a total', () => {
    expect(getShare(25, 100)).toBe(25);
  });

  it('returns "100" when the amount equals the total', () => {
    expect(getShare(50, 50)).toBe(100);
  });

  it('returns "0" when the amount is "0"', () => {
    expect(getShare(0, 100)).toBe(0);
  });

  it('throws when the total is "0"', () => {
    expect(() => getShare(5, 0)).toThrow('Cannot calculate share of a total of "0".');
  });
});
