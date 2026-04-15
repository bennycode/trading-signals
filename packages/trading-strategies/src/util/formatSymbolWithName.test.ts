import {describe, expect, it} from 'vitest';
import {formatSymbolWithName} from './formatSymbolWithName.js';

describe('formatSymbolWithName', () => {
  const names = new Map<string, string>([
    ['ORCL', 'Oracle Corp'],
    ['RHI', 'Robert Half International'],
    ['AAPL', 'Apple Inc.'],
  ]);

  it('returns bare symbol when name is unknown', () => {
    expect(formatSymbolWithName('XYZ', names, 12)).toBe('XYZ');
  });

  it('truncates long names with an ellipsis', () => {
    const result = formatSymbolWithName('RHI', names, 12);
    expect(result).toBe('Robert Half… (RHI)');
  });

  it('pads short names so the opening bracket lines up with truncated names', () => {
    const short = formatSymbolWithName('ORCL', names, 12);
    const truncated = formatSymbolWithName('RHI', names, 12);

    expect(short).toBe('Oracle Corp  (ORCL)');
    expect(truncated).toBe('Robert Half… (RHI)');

    expect(short.indexOf('(')).toBe(truncated.indexOf('('));
  });

  it('keeps names that exactly match the max length unchanged (no truncation, no extra padding)', () => {
    const namesExact = new Map([['EXACT', 'Twelve Chars']]);
    expect(formatSymbolWithName('EXACT', namesExact, 12)).toBe('Twelve Chars (EXACT)');
  });
});
