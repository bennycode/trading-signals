import {addPercentageChange} from './addPercentageChange.js';

describe('addPercentageChange', () => {
  it('adds a positive percentage to the base value', () => {
    expect(addPercentageChange(100, 25)).toBe(125);
  });

  it('subtracts when given a negative percentage', () => {
    expect(addPercentageChange(200, -10)).toBe(180);
  });

  it('returns the base value when the percentage is "0"', () => {
    expect(addPercentageChange(42, 0)).toBe(42);
  });
});
