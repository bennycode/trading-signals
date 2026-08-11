import {hasCrossedOver} from './hasCrossedOver.js';

describe('hasCrossedOver', () => {
  it('returns true when A moves from below B to above B', () => {
    expect(hasCrossedOver(1, 2, 3, 2)).toBe(true);
  });

  it('returns true when A touched B and then rises above it', () => {
    expect(hasCrossedOver(2, 2, 3, 2)).toBe(true);
  });

  it('returns false when A was already above B', () => {
    expect(hasCrossedOver(3, 2, 4, 2)).toBe(false);
  });

  it('returns false when A stays below B', () => {
    expect(hasCrossedOver(1, 2, 1.5, 2)).toBe(false);
  });

  it('returns false when both series stay equal', () => {
    expect(hasCrossedOver(2, 2, 2, 2)).toBe(false);
  });
});
