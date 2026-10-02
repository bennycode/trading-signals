import {describe, expect, it} from 'vitest';
import {
  computeTipRanksScorecard,
  scoreConsensus,
  scoreSmartScore,
  scoreTrailingPE,
} from './computeTipRanksScorecard.js';

describe('scoreSmartScore', () => {
  it('rewards a high TipRanks Smart Score', () => {
    expect(scoreSmartScore(9), 'outperform').toBe(2);
    expect(scoreSmartScore(7), 'leaning positive').toBe(1);
    expect(scoreSmartScore(5), 'neutral').toBe(0);
    expect(scoreSmartScore(3), 'underperform').toBe(-2);
  });
});

describe('scoreConsensus', () => {
  it('maps the analyst consensus label, ignoring spacing and case', () => {
    expect(scoreConsensus('Strong Buy')).toBe(2);
    expect(scoreConsensus('StrongBuy')).toBe(2);
    expect(scoreConsensus('Moderate Buy')).toBe(1);
    expect(scoreConsensus('Hold')).toBe(0);
    expect(scoreConsensus('Strong Sell')).toBe(-2);
  });
});

describe('scoreTrailingPE', () => {
  it('uses higher bands than the forward version (trailing runs richer)', () => {
    expect(scoreTrailingPE(20)).toBe(2);
    expect(scoreTrailingPE(40)).toBe(1);
    expect(scoreTrailingPE(70)).toBe(0);
    expect(scoreTrailingPE(120), 'very rich').toBe(-1);
    expect(scoreTrailingPE(-5), 'loss-making').toBe(-1);
  });
});

describe('computeTipRanksScorecard', () => {
  it('ranks a strong, un-stretched name above an overextended one', () => {
    const rows = computeTipRanksScorecard([
      {
        consensus: 'Strong Buy',
        movingAverage200: 420.72,
        price: 1213.56,
        smartScore: 9,
        targetConsensus: 1496.52,
        ticker: 'MU',
        trailingPE: 52.9,
      },
      {
        consensus: 'Buy',
        movingAverage200: 275,
        price: 675.39,
        smartScore: 9,
        targetConsensus: 479.29,
        ticker: 'WDC',
        trailingPE: 39.7,
      },
    ]);

    expect(rows[0].ticker, 'MU keeps upside; WDC overshot and is far above its 200-day').toBe('MU');
    expect(rows[0].score).toBeGreaterThan(rows[1].score);
  });

  it('is order-independent', () => {
    const inputs = [
      {
        consensus: 'Strong Buy',
        movingAverage200: 420,
        price: 1213,
        smartScore: 9,
        targetConsensus: 1496,
        ticker: 'MU',
        trailingPE: 52,
      },
      {
        consensus: 'Hold',
        movingAverage200: 57,
        price: 132,
        smartScore: 4,
        targetConsensus: 91,
        ticker: 'INTC',
        trailingPE: 120,
      },
    ];
    expect(computeTipRanksScorecard(inputs).map(r => r.ticker)).toEqual(
      computeTipRanksScorecard([...inputs].reverse()).map(r => r.ticker)
    );
  });
});
