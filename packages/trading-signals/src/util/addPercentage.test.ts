import {addPercentage} from './addPercentage.js';

describe('addPercentage', () => {
  it('adds a positive percentage to the base value', () => {
    expect(addPercentage(100, 25)).toBe(125);
  });

  it('subtracts when given a negative percentage', () => {
    expect(addPercentage(200, -10)).toBe(180);
  });

  it('returns the base value when the percentage is "0"', () => {
    expect(addPercentage(42, 0)).toBe(42);
  });
});
