import {describe, expect, it} from 'vitest';
import {computeRebalance} from './computeRebalance.js';

const COUNT = 5;

describe('computeRebalance', () => {
  it('buys the full set on a fresh (empty) portfolio, equal-weight', () => {
    const plan = computeRebalance([], ['MU', 'GOOG', 'GOOGL', 'AMCR', 'KEYS'], 100_000, COUNT);

    expect(plan.sells, 'nothing to sell').toEqual([]);
    expect(plan.holds, 'nothing held yet').toEqual([]);
    expect(plan.buys.map(b => b.ticker)).toEqual(['MU', 'GOOG', 'GOOGL', 'AMCR', 'KEYS']);
    expect(
      plan.buys.every(b => b.notionalUsd === 20_000),
      'each gets equity / 5'
    ).toBe(true);
  });

  it('produces an empty plan when the target set is unchanged (low churn)', () => {
    const holdings = [
      {marketValueUsd: 25_000, ticker: 'MU'},
      {marketValueUsd: 18_000, ticker: 'GOOG'},
      {marketValueUsd: 21_000, ticker: 'GOOGL'},
      {marketValueUsd: 19_000, ticker: 'AMCR'},
      {marketValueUsd: 17_000, ticker: 'KEYS'},
    ];
    const plan = computeRebalance(holdings, ['MU', 'GOOG', 'GOOGL', 'AMCR', 'KEYS'], 100_000, COUNT);

    expect(plan.sells, 'no trades').toEqual([]);
    expect(plan.buys, 'no trades').toEqual([]);
    expect(plan.holds).toHaveLength(5);
  });

  it('swaps only the names that changed, leaving the rest untouched', () => {
    const holdings = [
      {marketValueUsd: 30_000, ticker: 'MU'}, // drifted up, stays in set — not re-weighted
      {marketValueUsd: 18_000, ticker: 'GOOG'},
      {marketValueUsd: 21_000, ticker: 'GOOGL'},
      {marketValueUsd: 19_000, ticker: 'AMCR'},
      {marketValueUsd: 12_000, ticker: 'ON'}, // dropped out of the new top 5
    ];
    // ON replaced by AMD; the other four are unchanged.
    const plan = computeRebalance(holdings, ['MU', 'GOOG', 'GOOGL', 'AMCR', 'AMD'], 100_000, COUNT);

    expect(plan.sells, 'liquidate the dropout at its full value').toEqual([
      {notionalUsd: 12_000, side: 'SELL', ticker: 'ON'},
    ]);
    expect(plan.buys, 'buy the entrant at equal weight').toEqual([{notionalUsd: 20_000, side: 'BUY', ticker: 'AMD'}]);
    expect(plan.holds.sort(), 'the unchanged four are held, no re-weight on MU').toEqual([
      'AMCR',
      'GOOG',
      'GOOGL',
      'MU',
    ]);
  });

  it('liquidates everything when the target set is empty', () => {
    const holdings = [
      {marketValueUsd: 25_000, ticker: 'MU'},
      {marketValueUsd: 18_000, ticker: 'GOOG'},
    ];
    const plan = computeRebalance(holdings, [], 100_000, COUNT);

    expect(plan.sells.map(s => s.ticker).sort()).toEqual(['GOOG', 'MU']);
    expect(plan.buys).toEqual([]);
    expect(plan.holds).toEqual([]);
  });

  it('leaves cash when fewer than positionCount names qualify', () => {
    const plan = computeRebalance([], ['MU', 'GOOG'], 100_000, COUNT);

    expect(
      plan.buys.every(b => b.notionalUsd === 20_000),
      'still equity / 5, not equity / 2'
    ).toBe(true);
    // 2 x 20k invested, 60k left in cash by design.
    expect(plan.buys.reduce((sum, b) => sum + b.notionalUsd, 0)).toBe(40_000);
  });
});
