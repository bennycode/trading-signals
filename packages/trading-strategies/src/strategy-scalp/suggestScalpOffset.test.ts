import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import type {ExchangeCandle} from '@typedtrader/exchange';
import {suggestScalpOffset} from './suggestScalpOffset.js';

function makeCandle(open: number, high: number, low: number, close: number, index: number): ExchangeCandle {
  return {
    base: 'AAPL',
    close: String(close),
    counter: 'USD',
    high: String(high),
    low: String(low),
    open: String(open),
    openTimeInISO: new Date(1735689600000 + index * 3600000).toISOString(),
    openTimeInMillis: 1735689600000 + index * 3600000,
    sizeInMillis: 3600000,
    volume: '1000',
  };
}

describe('suggestScalpOffset', () => {
  it('throws when not enough candles are provided', () => {
    const candles = [makeCandle(100, 101, 99, 100, 0)];
    expect(() => suggestScalpOffset(candles)).toThrow('Need at least 14 candles');
  });

  it('throws with custom atrPeriod when not enough candles', () => {
    const candles = Array.from({length: 4}, (_, i) => makeCandle(100, 101, 99, 100, i));
    expect(() => suggestScalpOffset(candles, 5)).toThrow('Need at least 5 candles');
  });

  it('returns a positive offset', () => {
    // 20 candles with moderate volatility (high-low spread of ~4)
    const candles = Array.from({length: 20}, (_, i) => {
      const base = 100 + (i % 3) * 2;
      return makeCandle(base, base + 2, base - 2, base + 1, i);
    });

    const offset = suggestScalpOffset(candles);

    expect(offset).toBeInstanceOf(Big);
    expect(offset.gt(0)).toBe(true);
  });

  it('returns a larger offset for more volatile candles', () => {
    // Low volatility: tight range
    const lowVol = Array.from({length: 20}, (_, i) =>
      makeCandle(100, 100.5, 99.5, 100, i)
    );

    // High volatility: wide range
    const highVol = Array.from({length: 20}, (_, i) =>
      makeCandle(100, 110, 90, 100, i)
    );

    const lowOffset = suggestScalpOffset(lowVol);
    const highOffset = suggestScalpOffset(highVol);

    expect(highOffset.gt(lowOffset)).toBe(true);
  });

  it('accepts a custom atrPeriod', () => {
    const candles = Array.from({length: 10}, (_, i) => {
      const base = 100 + (i % 3) * 2;
      return makeCandle(base, base + 2, base - 2, base + 1, i);
    });

    const offset = suggestScalpOffset(candles, 5);

    expect(offset).toBeInstanceOf(Big);
    expect(offset.gt(0)).toBe(true);
  });
});
