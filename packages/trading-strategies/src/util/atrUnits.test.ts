import {describe, expect, it} from 'vitest';
import {atrMultipleToPercent, classifyAtrMultiple, percentToAtrMultiple} from './atrUnits.js';

describe('percentToAtrMultiple', () => {
  it('reproduces the STX statement: a 10% trail at 7.11% ATR is ~1.4x ATR', () => {
    expect(percentToAtrMultiple(10, 7.11)).toBeCloseTo(1.41, 2);
  });

  it('throws when ATR% is not positive', () => {
    expect(() => percentToAtrMultiple(10, 0)).toThrowError('atrPercent must be greater than 0');
  });
});

describe('atrMultipleToPercent', () => {
  it('returns the percentage that yields the given ATR multiple', () => {
    expect(atrMultipleToPercent(3, 7.11)).toBeCloseTo(21.33, 2);
  });

  it('is the inverse of percentToAtrMultiple', () => {
    expect(atrMultipleToPercent(percentToAtrMultiple(10, 7.11), 7.11)).toBeCloseTo(10, 10);
  });
});

describe('classifyAtrMultiple', () => {
  it('flags the STX 1.4x trail as whippy', () => {
    expect(classifyAtrMultiple(1.41)).toBe('whippy');
  });

  it('treats the Chandelier Exit 3x default as balanced', () => {
    expect(classifyAtrMultiple(3)).toBe('balanced');
  });

  it('flags a 4x trail as loose', () => {
    expect(classifyAtrMultiple(4)).toBe('loose');
  });

  it('includes the lower edge in balanced and the upper edge in loose', () => {
    expect(classifyAtrMultiple(2)).toBe('balanced');
    expect(classifyAtrMultiple(3.5)).toBe('loose');
  });
});
