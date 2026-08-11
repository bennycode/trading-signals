import {hasCrossedUnder} from './hasCrossedUnder.js';

describe('hasCrossedUnder', () => {
  it('returns true when A moves from above B to below B', () => {
    expect(hasCrossedUnder(3, 2, 1, 2)).toBe(true);
  });

  it('returns true when A touched B and then falls below it', () => {
    expect(hasCrossedUnder(2, 2, 1, 2)).toBe(true);
  });

  it('returns false when A was already below B', () => {
    expect(hasCrossedUnder(1, 2, 0.5, 2)).toBe(false);
  });

  it('returns false when A stays above B', () => {
    expect(hasCrossedUnder(3, 2, 2.5, 2)).toBe(false);
  });

  it('returns false when both series stay equal', () => {
    expect(hasCrossedUnder(2, 2, 2, 2)).toBe(false);
  });
});
