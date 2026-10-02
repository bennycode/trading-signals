import {describe, expect, it} from 'vitest';
import {
  computeHypeScreen,
  getDilutionPct,
  getIdiosyncraticVolatilityPct,
  getMaxDailyReturnPct,
  getMomentumPct,
  getPercentiles,
} from './computeHypeScreen.js';

/** A year and a day of closes, so every price factor has its full window. */
const DAYS = 253;

/** Closes that drift up by a small, varying step, so they carry variance without big jumps. */
function steadyCloses(start = 100) {
  return Array.from({length: DAYS}, (_, day) => start + day * 0.1 + (day % 3) * 0.05);
}

describe('getMomentumPct', () => {
  it('measures the return from twelve months ago to one month ago', () => {
    const closes = Array.from({length: DAYS}, () => 100);
    closes[DAYS - 1 - 21] = 150;
    closes[DAYS - 1] = 50;

    expect(getMomentumPct(closes), 'the last month is skipped, so its drop does not count').toBe(50);
  });

  it('is unknown without a full year of closes', () => {
    expect(getMomentumPct(Array.from({length: 252}, () => 100))).toBeNull();
  });
});

describe('getMaxDailyReturnPct', () => {
  it('finds the largest single-day gain of the last month', () => {
    const closes = Array.from({length: 22}, () => 100);
    closes[10] = 110;

    expect(getMaxDailyReturnPct(closes)).toBeCloseTo(10);
  });

  it('ignores gains older than a month', () => {
    const closes = Array.from({length: 23}, () => 100);
    closes[1] = 200;

    expect(getMaxDailyReturnPct(closes), 'the jump lies outside the window').toBe(0);
  });

  it('is unknown without a month of closes', () => {
    expect(getMaxDailyReturnPct(Array.from({length: 21}, () => 100))).toBeNull();
  });
});

describe('getIdiosyncraticVolatilityPct', () => {
  it('is zero for a stock that only moves with the market', () => {
    const market = steadyCloses();
    const stock = market.map(close => close * 2);

    expect(getIdiosyncraticVolatilityPct(stock, market)).toBeCloseTo(0);
  });

  it('keeps the whole volatility when the market stands still', () => {
    const market = Array.from({length: DAYS}, () => 100);
    const stock = Array.from({length: DAYS}, (_, day) => (day % 2 === 0 ? 100 : 110));

    expect(
      getIdiosyncraticVolatilityPct(stock, market),
      'nothing of the swing is explained by the market'
    ).toBeGreaterThan(9);
  });

  it('is zero for a stock that does not move', () => {
    expect(
      getIdiosyncraticVolatilityPct(
        Array.from({length: DAYS}, () => 100),
        steadyCloses()
      )
    ).toBe(0);
  });

  it('is unknown without a quarter of closes', () => {
    const closes = Array.from({length: 63}, () => 100);

    expect(getIdiosyncraticVolatilityPct(closes, closes)).toBeNull();
  });
});

describe('getDilutionPct', () => {
  it('measures the growth of the diluted share count', () => {
    expect(getDilutionPct({current: 110, yearAgo: 100})).toBe(10);
  });

  it('is negative for buybacks', () => {
    expect(getDilutionPct({current: 95, yearAgo: 100})).toBe(-5);
  });

  it('is unknown without a usable share count', () => {
    expect(getDilutionPct(null)).toBeNull();
    expect(getDilutionPct({current: 100, yearAgo: 0})).toBeNull();
  });
});

describe('getPercentiles', () => {
  it('ranks from worst to best', () => {
    expect(getPercentiles([1, 3, 2], true)).toEqual([0, 1, 0.5]);
    expect(getPercentiles([1, 3, 2], false)).toEqual([1, 0, 0.5]);
  });

  it('gives tied values the same percentile', () => {
    expect(getPercentiles([1, 1, 2], true)).toEqual([0.25, 0.25, 1]);
  });

  it('leaves unknown values unranked', () => {
    expect(getPercentiles([null, 1, 2], true), 'the unknown value neither counts nor ranks').toEqual([null, 0, 1]);
  });

  it('places a single known value in the middle', () => {
    expect(getPercentiles([7], true)).toEqual([0.5]);
  });
});

describe('computeHypeScreen', () => {
  const market = steadyCloses();

  it('ranks a hyped stock below a steady one', () => {
    const steady = steadyCloses();
    const hyped = steadyCloses().map((close, day) => (day >= DAYS - 5 ? close * 1.4 : close));

    const rows = computeHypeScreen([
      {closes: hyped, dilutedShares: {current: 130, yearAgo: 100}, marketCloses: market, ticker: 'HYPE'},
      {closes: steady, dilutedShares: {current: 98, yearAgo: 100}, marketCloses: market, ticker: 'STDY'},
    ]);

    expect(rows.map(row => row.ticker)).toEqual(['STDY', 'HYPE']);
    expect(rows[1].percentiles, 'the jump, the swing and the issuance all count against it').toMatchObject({
      dilutionPct: 0,
      idiosyncraticVolatilityPct: 0,
      maxDailyReturnPct: 0,
    });
  });

  it('averages only the factors that are known', () => {
    const [row] = computeHypeScreen([{closes: market, dilutedShares: null, marketCloses: market, ticker: 'ONLY'}]);

    expect(row.percentiles.dilutionPct).toBeNull();
    expect(row.score, 'a lone stock sits in the middle of every known factor').toBe(0.5);
  });

  it('puts stocks without any known factor last', () => {
    const short = market.slice(-10);

    const rows = computeHypeScreen([
      {closes: short, dilutedShares: null, marketCloses: short, ticker: 'AAA'},
      {closes: short, dilutedShares: {current: 100, yearAgo: 100}, marketCloses: short, ticker: 'ZZZ'},
    ]);

    expect(rows.map(row => [row.ticker, row.score])).toEqual([
      ['ZZZ', 0.5],
      ['AAA', null],
    ]);
  });

  it('rejects closes that do not line up with the market', () => {
    expect(() =>
      computeHypeScreen([{closes: market.slice(1), dilutedShares: null, marketCloses: market, ticker: 'MU'}])
    ).toThrow('The closes of "MU" cover "252" days, but the market closes cover "253".');
  });
});
