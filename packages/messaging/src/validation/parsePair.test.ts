import {describe, it, expect} from 'vitest';
import {parsePair} from './parsePair.js';

describe('parsePair', () => {
  it('parses a valid pair', () => {
    const pair = parsePair('SHOP,USD');
    expect(pair).not.toBeNull();
    expect(pair!.base).toBe('SHOP');
    expect(pair!.counter).toBe('USD');
  });

  it('returns null for missing comma', () => {
    expect(parsePair('SHOPUSD')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parsePair('')).toBeNull();
  });

  it('handles pairs with lowercase', () => {
    const pair = parsePair('btc,usd');
    expect(pair).not.toBeNull();
    expect(pair!.base).toBe('btc');
    expect(pair!.counter).toBe('usd');
  });
});
