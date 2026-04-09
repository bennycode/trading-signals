import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import type {ExchangeCandle} from '@typedtrader/exchange';
import {suggestScalpOffset} from './suggestScalpOffset.js';

function makeDailyCandle(open: number, high: number, low: number, close: number, dayIndex: number): ExchangeCandle {
  const dayMs = 1735689600000 + dayIndex * 86_400_000;
  return {
    base: 'AAPL',
    close: String(close),
    counter: 'USD',
    high: String(high),
    low: String(low),
    open: String(open),
    openTimeInISO: new Date(dayMs).toISOString(),
    openTimeInMillis: dayMs,
    sizeInMillis: 86_400_000,
    volume: '1000',
  };
}

function makeHourlyCandle(open: number, high: number, low: number, close: number, dayIndex: number, hourIndex: number): ExchangeCandle {
  const hourMs = 1735689600000 + dayIndex * 86_400_000 + hourIndex * 3_600_000;
  return {
    base: 'AAPL',
    close: String(close),
    counter: 'USD',
    high: String(high),
    low: String(low),
    open: String(open),
    openTimeInISO: new Date(hourMs).toISOString(),
    openTimeInMillis: hourMs,
    sizeInMillis: 3_600_000,
    volume: '1000',
  };
}

describe('suggestScalpOffset', () => {
  it('throws when not enough trading days are available', () => {
    const candles = [makeDailyCandle(100, 101, 99, 100, 0)];
    expect(() => suggestScalpOffset(candles)).toThrow('Need at least 14 trading days');
  });

  it('throws with custom atrPeriod when not enough trading days', () => {
    const candles = Array.from({length: 4}, (_, i) => makeDailyCandle(100, 101, 99, 100, i));
    expect(() => suggestScalpOffset(candles, 5)).toThrow('Need at least 5 trading days');
  });

  it('returns a positive offset for daily candles', () => {
    const candles = Array.from({length: 20}, (_, i) => {
      const base = 100 + (i % 3) * 2;
      return makeDailyCandle(base, base + 2, base - 2, base + 1, i);
    });

    const offset = suggestScalpOffset(candles);

    expect(offset).toBeInstanceOf(Big);
    expect(offset.gt(0)).toBe(true);
  });

  it('returns a larger offset for more volatile candles', () => {
    const lowVol = Array.from({length: 20}, (_, i) =>
      makeDailyCandle(100, 100.5, 99.5, 100, i)
    );

    const highVol = Array.from({length: 20}, (_, i) =>
      makeDailyCandle(100, 110, 90, 100, i)
    );

    const lowOffset = suggestScalpOffset(lowVol);
    const highOffset = suggestScalpOffset(highVol);

    expect(highOffset.gt(lowOffset)).toBe(true);
  });

  it('accepts a custom atrPeriod', () => {
    const candles = Array.from({length: 10}, (_, i) => {
      const base = 100 + (i % 3) * 2;
      return makeDailyCandle(base, base + 2, base - 2, base + 1, i);
    });

    const offset = suggestScalpOffset(candles, 5);

    expect(offset).toBeInstanceOf(Big);
    expect(offset.gt(0)).toBe(true);
  });

  it('aggregates sub-daily candles to daily before computing ATR', () => {
    // Create 20 days of hourly candles (7 hours per day, like a trading session)
    const hourlyCandles: ExchangeCandle[] = [];
    for (let day = 0; day < 20; day++) {
      for (let hour = 0; hour < 7; hour++) {
        const base = 100 + (day % 3) * 2;
        hourlyCandles.push(makeHourlyCandle(base, base + 2, base - 2, base + 1, day, hour));
      }
    }

    // Same data as daily candles
    const dailyCandles = Array.from({length: 20}, (_, i) => {
      const base = 100 + (i % 3) * 2;
      return makeDailyCandle(base, base + 2, base - 2, base + 1, i);
    });

    const hourlyOffset = suggestScalpOffset(hourlyCandles);
    const dailyOffset = suggestScalpOffset(dailyCandles);

    // Should produce the same result since hourly candles are aggregated to daily
    expect(hourlyOffset.toFixed(4)).toBe(dailyOffset.toFixed(4));
  });
});
