import {describe, expect, it, vi} from 'vitest';
import type {AlpacaAPI, Bar, CompanyConcept, SecEdgarAPI} from '@typedtrader/exchange';
import {HypeScreen} from './HypeScreen.js';

const DAYS = Array.from({length: 260}, (_, index) => new Date(Date.UTC(2025, 8, 1) + index * 86_400_000).toISOString());

function bars(closeOnDay: (index: number) => number, skipDay?: number): Bar[] {
  return DAYS.flatMap((t, index) =>
    index === skipDay ? [] : [{c: closeOnDay(index), h: 0, l: 0, n: 0, o: 0, t, v: 0, vw: 0}]
  );
}

function sharesConcept(current: number, yearAgo: number): CompanyConcept {
  const filed = '2026-04-30';
  return {
    cik: 1,
    entityName: 'Sample',
    tag: 'WeightedAverageNumberOfDilutedSharesOutstanding',
    taxonomy: 'us-gaap',
    units: {
      shares: [
        {accn: 'q1', end: '2026-03-31', filed, form: '10-Q', start: '2026-01-01', val: current},
        {accn: 'q1', end: '2025-03-31', filed, form: '10-Q', start: '2025-01-01', val: yearAgo},
      ],
    },
  };
}

const asOf = new Date('2026-05-18');

describe('HypeScreen', () => {
  it('screens closes from every page against the market on the days both traded', async () => {
    const getStockBars = vi
      .fn<AlpacaAPI['getStockBars']>()
      .mockResolvedValueOnce({bars: {SPY: bars(index => 400 + index)}, next_page_token: 'page-2'})
      .mockResolvedValueOnce({
        bars: {'BRK.B': bars(index => 300 + index * 0.5, 10), MU: bars(index => 100 + index * (index % 2))},
        next_page_token: null,
      });
    const getCompanyTickers = vi.fn<SecEdgarAPI['getCompanyTickers']>().mockResolvedValue(
      new Map([
        ['BRK-B', 2],
        ['MU', 1],
      ])
    );
    const getCompanyConcept = vi
      .fn<SecEdgarAPI['getCompanyConcept']>()
      .mockImplementation(async cik => (cik === 1 ? sharesConcept(1_100, 1_000) : null));

    const rows = await new HypeScreen({getStockBars}, {getCompanyConcept, getCompanyTickers}).screen(
      ['MU', 'BRK.B'],
      asOf
    );

    expect(getStockBars.mock.calls[1][0]).toMatchObject({page_token: 'page-2', symbols: 'MU,BRK.B,SPY'});
    expect(getCompanyConcept, 'a dotted ticker is looked up the way the SEC spells it').toHaveBeenCalledWith(
      2,
      'us-gaap',
      'WeightedAverageNumberOfDilutedSharesOutstanding'
    );

    const mu = rows.find(row => row.ticker === 'MU');
    const berkshire = rows.find(row => row.ticker === 'BRK.B');
    expect(mu?.factors.dilutionPct).toBeCloseTo(10);
    expect(berkshire?.factors.dilutionPct, 'the SEC has no share counts for it').toBeNull();
    expect(berkshire?.factors.momentumPct, 'the missing day is dropped instead of failing the screen').not.toBeNull();
  });

  it('leaves the dilution unknown for a company the SEC does not list', async () => {
    const getStockBars = vi.fn<AlpacaAPI['getStockBars']>().mockResolvedValue({
      bars: {SPY: bars(index => 400 + index), XYZ: bars(index => 50 + index)},
      next_page_token: null,
    });
    const getCompanyConcept = vi.fn<SecEdgarAPI['getCompanyConcept']>();
    const getCompanyTickers = vi.fn<SecEdgarAPI['getCompanyTickers']>().mockResolvedValue(new Map());

    const [row] = await new HypeScreen({getStockBars}, {getCompanyConcept, getCompanyTickers}).screen(['XYZ'], asOf);

    expect(row.factors.dilutionPct).toBeNull();
    expect(getCompanyConcept).not.toHaveBeenCalled();
  });
});
