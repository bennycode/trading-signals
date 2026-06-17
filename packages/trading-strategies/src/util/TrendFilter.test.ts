import {SMA} from 'trading-signals';
import {describe, expect, it} from 'vitest';
import {TrendFilter} from './TrendFilter.js';

describe('TrendFilter', () => {
  it('is not ready until the moving average is stable', () => {
    const filter = new TrendFilter(new SMA(3));

    filter.add(10);
    filter.add(20);

    expect(filter.isReady).toBe(false);
    expect(filter.value).toBeNull();
  });

  it('exposes the trend line value once warmed up', () => {
    const filter = new TrendFilter(new SMA(3));

    filter.add(10);
    filter.add(20);
    filter.add(30);

    expect(filter.isReady).toBe(true);
    expect(filter.value).toBe(20);
  });

  it('reports prices at or above the trend line as above', () => {
    const filter = new TrendFilter(new SMA(3));

    [10, 20, 30].forEach(close => filter.add(close));

    expect(filter.isAbove(25)).toBe(true);
    expect(filter.isAbove(20)).toBe(true);
  });

  it('reports prices below the trend line as not above', () => {
    const filter = new TrendFilter(new SMA(3));

    [10, 20, 30].forEach(close => filter.add(close));

    expect(filter.isAbove(19)).toBe(false);
  });

  it('makes no claim before warmup, so isAbove stays false', () => {
    const filter = new TrendFilter(new SMA(3));

    filter.add(10);

    expect(filter.isAbove(1_000)).toBe(false);
  });
});
