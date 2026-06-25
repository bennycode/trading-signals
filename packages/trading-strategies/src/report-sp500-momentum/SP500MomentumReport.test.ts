import {describe, expect, it} from 'vitest';
import {AlpacaAPI} from '@typedtrader/exchange';
import {SP500_TIMEZONE} from '../util/sp500Tickers.js';
import {
  getExchangeYearMonth,
  getMomentumWindow,
  rankDeltaIcon,
  SP500MomentumReport,
  SP500MomentumSchema,
  withRankDeltas,
} from './SP500MomentumReport.js';

function createApi(): AlpacaAPI {
  return new AlpacaAPI({apiKey: 'test-key', apiSecret: 'test-secret', usePaperTrading: true});
}

/** Builds a ranking (best first) from tickers; only ticker and order matter to the delta logic. */
function ranking(...tickers: string[]) {
  return tickers.map((ticker, index) => ({
    price12MonthsAgo: 100,
    priceNow: 100,
    returnPct: tickers.length - index,
    ticker,
  }));
}

describe('SP500MomentumReport', () => {
  it('has the correct NAME', () => {
    expect(SP500MomentumReport.NAME).toBe('@typedtrader/report-sp500-momentum');
  });

  it('accepts an empty config (credentials come from the injected AlpacaAPI)', () => {
    expect(() => SP500MomentumSchema.parse({})).not.toThrow();
  });

  it('stores config from constructor', () => {
    const config = SP500MomentumSchema.parse({});
    const report = new SP500MomentumReport(config, createApi());
    expect(report.config).toEqual({});
  });
});

describe('getExchangeYearMonth', () => {
  it('reads the month at the exchange, not in UTC', () => {
    // 23:30 EDT on Jun 30 is already Jul 1 in UTC — a UTC read would roll the report a day early.
    const result = getExchangeYearMonth('2025-06-30T23:30:00-04:00', SP500_TIMEZONE);
    expect(result, 'late-June evening in New York still belongs to June').toEqual({month: 6, year: 2025});
  });

  it('handles the winter offset across a year boundary', () => {
    // 23:00 EST on Jan 31 is Feb 1 in UTC; the exchange-local month is still January.
    const result = getExchangeYearMonth('2025-01-31T23:00:00-05:00', SP500_TIMEZONE);
    expect(result, 'late-January evening in New York still belongs to January').toEqual({month: 1, year: 2025});
  });
});

describe('getMomentumWindow', () => {
  it('skips the current month and spans the prior twelve', () => {
    const {pastDate, recentDate} = getMomentumWindow(2025, 6);
    expect(recentDate.toISOString(), 'formation ends at the start of May (prior month)').toBe(
      '2025-05-01T00:00:00.000Z'
    );
    expect(pastDate.toISOString(), 'formation begins twelve months earlier').toBe('2024-05-01T00:00:00.000Z');
  });

  it('rolls back across the year boundary in January', () => {
    const {pastDate, recentDate} = getMomentumWindow(2025, 1);
    // Dec 1, 2024 is a Sunday, so the first trading day shifts to Monday the 2nd.
    expect(recentDate.toISOString(), 'prior month of January is the preceding December').toBe(
      '2024-12-02T00:00:00.000Z'
    );
    expect(pastDate.toISOString()).toBe('2023-12-01T00:00:00.000Z');
  });

  it('advances a weekend first-of-month to the next trading day', () => {
    const {recentDate} = getMomentumWindow(2025, 12);
    // Nov 1, 2025 is a Saturday → skip to Monday the 3rd.
    expect(recentDate.toISOString(), 'a Saturday first-of-month resolves to Monday').toBe('2025-11-03T00:00:00.000Z');
  });

  it('previous-month window is exactly one month behind the current one', () => {
    // Current eval month June → previous eval month May, so the window ends Apr (M-2), starts Apr prior year (M-14).
    const previous = getMomentumWindow(2025, 5);
    expect(previous.recentDate.toISOString(), 'previous window ends one month earlier').toBe(
      '2025-04-01T00:00:00.000Z'
    );
    expect(previous.pastDate.toISOString(), 'previous window starts one month earlier').toBe(
      '2024-04-01T00:00:00.000Z'
    );
  });
});

describe('withRankDeltas', () => {
  it('computes rank movement against the previous month, flagging newcomers', () => {
    const previous = ranking('A', 'B', 'C', 'D'); // A=1, B=2, C=3, D=4
    const current = ranking('C', 'A', 'B', 'E'); // C=1, A=2, B=3, E=4

    const result = withRankDeltas(current, previous).map(r => [r.ticker, r.rank, r.rankDelta]);

    expect(result).toEqual([
      ['C', 1, 2], // 3 → 1, climbed two spots
      ['A', 2, -1], // 1 → 2, slipped one
      ['B', 3, -1], // 2 → 3, slipped one
      ['E', 4, null], // not ranked last month
    ]);
  });
});

describe('rankDeltaIcon', () => {
  it('shows a direction arrow only when the rank moved', () => {
    expect(rankDeltaIcon(3), 'climbed').toBe('▲');
    expect(rankDeltaIcon(-2), 'slipped').toBe('▼');
    expect(rankDeltaIcon(0), 'held').toBe('');
    expect(rankDeltaIcon(null), 'new entry, unranked last month').toBe('★');
  });
});
