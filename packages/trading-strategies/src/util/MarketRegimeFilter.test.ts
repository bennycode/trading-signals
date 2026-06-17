import {SMA} from 'trading-signals';
import {describe, expect, it} from 'vitest';
import {MarketRegimeFilter} from './MarketRegimeFilter.js';

describe('MarketRegimeFilter', () => {
  it('does not signal an exit until the trend average is stable', () => {
    const filter = new MarketRegimeFilter({trendMovingAverage: new SMA(2)});

    filter.addIndexClose(100);

    expect(filter.isReady).toBe(false);
    expect(filter.shouldExit, 'an un-warmed filter makes no claim, so it must not force an exit').toBe(false);
  });

  it('does not signal an exit while the index holds above its trend line', () => {
    const filter = new MarketRegimeFilter({trendMovingAverage: new SMA(2)});

    filter.addIndexClose(100);
    filter.addIndexClose(102);

    expect(filter.isReady).toBe(true);
    expect(filter.shouldExit).toBe(false);
  });

  it('signals an exit when the index closes below its trend line', () => {
    const filter = new MarketRegimeFilter({trendMovingAverage: new SMA(2)});

    filter.addIndexClose(100);
    filter.addIndexClose(90);

    expect(filter.shouldExit).toBe(true);
  });

  it('tracks drawdown from the running peak close', () => {
    const filter = new MarketRegimeFilter({trendMovingAverage: new SMA(2)});

    filter.addIndexClose(200);
    filter.addIndexClose(100);
    filter.addIndexClose(101);

    expect(filter.drawdown).toBeCloseTo(0.495, 3);
  });

  it('signals an exit on a deep drawdown even while above the trend line', () => {
    const guarded = new MarketRegimeFilter({maxDrawdownPct: 5, trendMovingAverage: new SMA(2)});
    const unguarded = new MarketRegimeFilter({trendMovingAverage: new SMA(2)});

    // [100, 101] sits above the SMA(2) of 100.5, but 101 is ~49.5% below the 200 peak.
    [200, 100, 101].forEach(close => {
      guarded.addIndexClose(close);
      unguarded.addIndexClose(close);
    });

    expect(unguarded.shouldExit).toBe(false);
    expect(guarded.shouldExit).toBe(true);
  });
});
