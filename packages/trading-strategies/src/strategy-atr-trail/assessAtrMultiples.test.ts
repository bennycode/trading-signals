import {uptrendStxCandles} from '@typedtrader/candles';
import {describe, expect, it} from 'vitest';
import {assessAtrMultiples} from './assessAtrMultiples.js';

const entryIndex = uptrendStxCandles.findIndex(candle => candle.openTimeInISO.startsWith('2026-05-12'));
const history = uptrendStxCandles.slice(0, entryIndex);
const candles = uptrendStxCandles.slice(entryIndex);

describe('assessAtrMultiples on STX', () => {
  it('reports each swept multiple with its band and actual outcome', async () => {
    const report = await assessAtrMultiples({baseBalance: '5', candles, history, multiples: [1.5, 2, 2.5, 3, 3.5]});

    expect(
      report.map(row => row.atrMultiple),
      'one row per multiple, in order'
    ).toEqual([1.5, 2, 2.5, 3, 3.5]);

    const byMultiple = new Map(report.map(row => [row.atrMultiple, row]));
    expect(byMultiple.get(1.5)?.band, 'static band: below 2x is whippy').toBe('whippy');
    expect(byMultiple.get(3)?.band, 'static band: 3x is balanced').toBe('balanced');
    expect(byMultiple.get(3.5)?.band, 'static band: 3.5x is loose').toBe('loose');
  });

  it('flags the tight 2x as whipsawed and the wider 3x as held', async () => {
    const report = await assessAtrMultiples({baseBalance: '5', candles, history, multiples: [2, 3]});
    const byMultiple = new Map(report.map(row => [row.atrMultiple, row]));

    const tight = byMultiple.get(2);
    expect(tight?.outcome, '2x exits then STX recovers above the exit -> whipsawed').toBe('whipsawed');
    expect(tight?.exited).toBe(true);

    const wide = byMultiple.get(3);
    expect(wide?.outcome, '3x rides through the shakeout').toBe('held');
    expect(wide?.exited).toBe(false);
  });

  it('shows the wider trail ending richer (positive edge vs the stopped-out tight one)', async () => {
    const report = await assessAtrMultiples({baseBalance: '5', candles, history, multiples: [2, 3]});
    const byMultiple = new Map(report.map(row => [row.atrMultiple, row]));

    const tightValue = byMultiple.get(2)?.finalValue ?? 0;
    const wideValue = byMultiple.get(3)?.finalValue ?? 0;
    expect(wideValue).toBeGreaterThan(tightValue);
  });

  it('throws when there are no candles to assess', async () => {
    await expect(assessAtrMultiples({candles: [], history})).rejects.toThrow('at least one candle');
  });
});
