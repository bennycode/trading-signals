import {describe, expect, it} from 'vitest';
import {CandleBatcher} from '@typedtrader/exchange';
import type {Candle} from '@typedtrader/exchange';
import {SMA} from 'trading-signals';
import {BatchedIndicator} from './BatchedIndicator.js';

function candle(openTimeInISO: string, close: number, sizeInMillis = 60_000): Candle {
  const price = String(close);
  return {
    base: 'AMD',
    close: price,
    counter: 'USD',
    high: price,
    low: price,
    open: price,
    openTimeInISO,
    openTimeInMillis: Date.parse(openTimeInISO),
    sizeInMillis,
    volume: '1',
  };
}

const minute = (openTimeInISO: string, close: number) =>
  CandleBatcher.createOneMinuteBatchedCandle([candle(openTimeInISO, close)]);

describe('BatchedIndicator', () => {
  it('feeds the indicator once per completed interval', () => {
    const sma = new SMA(2);
    const hourly = new BatchedIndicator('1h', sma, bar => bar.close.toNumber());

    expect(hourly.add(minute('2026-04-28T13:00:00.000Z', 10)), 'first minute of the hour').toBeUndefined();
    expect(hourly.add(minute('2026-04-28T13:30:00.000Z', 20)), 'hour still forming').toBeUndefined();
    expect(hourly.add(minute('2026-04-28T13:59:00.000Z', 30)), 'last minute closes the hour').toBeNull();
    expect(hourly.add(minute('2026-04-28T14:00:00.000Z', 45))).toBeUndefined();
    expect(hourly.add(minute('2026-04-28T14:59:00.000Z', 50)), 'SMA of the hourly closes 30 and 50').toBe(40);
    expect(sma.getResultOrThrow()).toBe(40);
  });

  it('warms up from bars that are already at the target interval', () => {
    const sma = new SMA(2);
    const hourly = new BatchedIndicator('1h', sma, bar => bar.close.toNumber());

    hourly.warmUp([
      candle('2026-04-28T11:00:00.000Z', 10, 3_600_000),
      candle('2026-04-28T12:00:00.000Z', 20, 3_600_000),
    ]);

    expect(sma.getResultOrThrow(), 'ready before the first live candle').toBe(15);
    expect(hourly.indicator).toBe(sma);
  });

  it('replaces an unfinished last warm-up bar once its interval completes', () => {
    const sma = new SMA(2);
    const hourly = new BatchedIndicator('1h', sma, bar => bar.close.toNumber());

    hourly.warmUp([
      candle('2026-04-28T11:00:00.000Z', 10, 3_600_000),
      candle('2026-04-28T12:00:00.000Z', 20, 3_600_000),
    ]);

    expect(hourly.getResult(), 'the open 12:00 bar counts for now').toBe(15);
    expect(hourly.add(minute('2026-04-28T12:30:00.000Z', 30)), 'hour still forming').toBeUndefined();
    expect(hourly.add(minute('2026-04-28T12:59:00.000Z', 40)), 'SMA of the hourly closes 10 and 40').toBe(25);
    expect(hourly.add(minute('2026-04-28T13:00:00.000Z', 50))).toBeUndefined();
    expect(hourly.add(minute('2026-04-28T13:59:00.000Z', 60)), 'SMA of the hourly closes 40 and 60').toBe(50);
  });

  it('keeps a finished last warm-up bar', () => {
    const sma = new SMA(2);
    const hourly = new BatchedIndicator('1h', sma, bar => bar.close.toNumber());

    hourly.warmUp([
      candle('2026-04-28T11:00:00.000Z', 10, 3_600_000),
      candle('2026-04-28T12:00:00.000Z', 20, 3_600_000),
    ]);

    expect(hourly.add(minute('2026-04-28T13:00:00.000Z', 30))).toBeUndefined();
    expect(hourly.add(minute('2026-04-28T13:59:00.000Z', 40)), 'SMA of the hourly closes 20 and 40').toBe(30);
  });
});
