import {downtrendMsftCandles, uptrendStxCandles, urth2024Candles} from '@typedtrader/candles';
import {describe, expect, it} from 'vitest';
import {assessTrailSuitability} from './assessTrailSuitability.js';

describe('assessTrailSuitability', () => {
  it('flags a sustained uptrend as opportunity-cost (URTH)', async () => {
    const report = await assessTrailSuitability(urth2024Candles);

    expect(report.verdict).toBe('opportunity-cost');
    expect(report.buyHoldReturnPct).toBeGreaterThan(10);
    expect(report.edgeVsBuyHoldPct).toBeLessThan(-10);
  });

  it('flags a sell-off as a protective fit (MSFT)', async () => {
    const report = await assessTrailSuitability(downtrendMsftCandles);

    expect(report.verdict).toBe('protective-fit');
    expect(report.buyHoldReturnPct).toBeLessThan(0);
    expect(report.edgeVsBuyHoldPct).toBeGreaterThan(5);
  });

  it('flags a ride-through when the trail never gets in the way (STX shakeout)', async () => {
    const start = uptrendStxCandles.findIndex(candle => candle.openTimeInISO.startsWith('2026-04-01'));
    const report = await assessTrailSuitability(uptrendStxCandles.slice(start));

    expect(report.verdict).toBe('rode-through');
    expect(Math.abs(report.edgeVsBuyHoldPct)).toBeLessThanOrEqual(1);
    expect(report.exited).toBe(false);
  });

  it('throws on empty input', async () => {
    await expect(assessTrailSuitability([])).rejects.toThrow('requires at least one candle');
  });
});
