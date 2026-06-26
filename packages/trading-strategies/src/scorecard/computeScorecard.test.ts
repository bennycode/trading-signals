import {describe, expect, it} from 'vitest';
import {
  computeScorecard,
  scoreExtension,
  scoreForwardPE,
  scoreGrowth,
  scoreRating,
  scoreRevisionMomentum,
  scoreUpside,
  selectForwardEps,
} from './computeScorecard.js';

describe('scoreUpside', () => {
  it('rewards room left and punishes overshoot', () => {
    expect(scoreUpside(20), 'clear upside').toBe(2);
    expect(scoreUpside(15), 'boundary is still the lower band').toBe(1);
    expect(scoreUpside(0), 'at target').toBe(1);
    expect(scoreUpside(-5), 'mild overshoot').toBe(0);
    expect(scoreUpside(-11), 'badly overshot').toBe(-2);
  });
});

describe('scoreExtension', () => {
  it('punishes a stretched chart', () => {
    expect(scoreExtension(10), 'close to the 200-day').toBe(2);
    expect(scoreExtension(40), 'moderately extended').toBe(1);
    expect(scoreExtension(80), 'extended').toBe(0);
    expect(scoreExtension(150), 'parabolic').toBe(-2);
  });
});

describe('scoreForwardPE', () => {
  it('rewards cheap-vs-growth and flags loss-making', () => {
    expect(scoreForwardPE(10)).toBe(2);
    expect(scoreForwardPE(30)).toBe(1);
    expect(scoreForwardPE(50)).toBe(0);
    expect(scoreForwardPE(80), 'rich').toBe(-1);
    expect(scoreForwardPE(null), 'loss-making').toBe(-1);
  });
});

describe('scoreGrowth', () => {
  it('rewards acceleration and punishes shrinkage', () => {
    expect(scoreGrowth(95)).toBe(2);
    expect(scoreGrowth(20)).toBe(1);
    expect(scoreGrowth(5)).toBe(0);
    expect(scoreGrowth(-34), 'earnings falling').toBe(-2);
    expect(scoreGrowth(null), 'loss-making').toBe(-2);
  });
});

describe('scoreRating', () => {
  it('maps the leading letter grade', () => {
    expect(scoreRating('A-')).toBe(1);
    expect(scoreRating('B+')).toBe(0);
    expect(scoreRating('C')).toBe(-1);
    expect(scoreRating('b (3)'), 'case-insensitive, ignores trailing detail').toBe(0);
  });
});

describe('scoreRevisionMomentum', () => {
  it('rewards rising targets and punishes cuts', () => {
    expect(scoreRevisionMomentum(4), 'targets raised sharply').toBe(2);
    expect(scoreRevisionMomentum(1), 'targets nudged up').toBe(1);
    expect(scoreRevisionMomentum(0), 'flat').toBe(0);
    expect(scoreRevisionMomentum(-2), 'targets being cut').toBe(-2);
  });
});

describe('computeScorecard', () => {
  it('ranks a clean entry above an overextended momentum name', () => {
    /*
     * GOOGL: room left, barely extended, reasonable multiple → high score.
     * WDC: overshot its target and ~146% over its 200-day → low score.
     */
    const rows = computeScorecard([
      {
        epsForwardYear1: 9.98737,
        epsForwardYear2: 17.79608,
        movingAverage200: 275.00195,
        price: 675.39,
        rating: 'B+',
        targetConsensus: 479.29,
        targetLastMonth: 479.29,
        targetLastQuarter: 479.29,
        ticker: 'WDC',
      },
      {
        epsForwardYear1: 14.24199,
        epsForwardYear2: 14.71419,
        movingAverage200: 312.8154,
        price: 343.71,
        rating: 'B+',
        targetConsensus: 411.8,
        targetLastMonth: 411.8,
        targetLastQuarter: 411.8,
        ticker: 'GOOGL',
      },
    ]);

    expect(
      rows.map(r => r.ticker),
      'cleaner entry ranks first'
    ).toEqual(['GOOGL', 'WDC']);
    expect(rows[0].score).toBeGreaterThan(rows[1].score);
  });

  it('treats a loss-making name as not meaningful for PE and growth', () => {
    const [row] = computeScorecard([
      {
        epsForwardYear1: -1.31671,
        epsForwardYear2: -0.050203,
        movingAverage200: 25.3797,
        price: 26.98,
        rating: 'C',
        targetConsensus: 30.8,
        targetLastMonth: 30.8,
        targetLastQuarter: 30.8,
        ticker: 'WBD',
      },
    ]);

    expect(row.forwardPE, 'no multiple when EPS is negative').toBeNull();
    expect(row.epsGrowthPct, 'no growth ratio when base EPS is negative').toBeNull();
    // upside +14% (+1), extension +6% (+2), PE null (-1), growth null (-2), rating C (-1), revision flat (0) = -1
    expect(row.score).toBe(-1);
  });

  it('lifts a name whose analysts are still raising targets', () => {
    const base = {
      epsForwardYear1: 10,
      epsForwardYear2: 12,
      movingAverage200: 100,
      price: 110,
      rating: 'B',
      targetConsensus: 120,
      ticker: 'AAA',
    };
    const [flat] = computeScorecard([{...base, targetLastMonth: 120, targetLastQuarter: 120}]);
    const [rising] = computeScorecard([{...base, targetLastMonth: 126, targetLastQuarter: 120}]); // +5%

    expect(rising.revisionPct, 'targets up 5%').toBeCloseTo(5);
    expect(rising.score - flat.score, 'rising targets add the +2 band').toBe(2);
  });

  it('treats a missing last-month target as neutral, not a 100% cut', () => {
    const [row] = computeScorecard([
      {
        epsForwardYear1: 10,
        epsForwardYear2: 12,
        movingAverage200: 100,
        price: 110,
        rating: 'B',
        targetConsensus: 120,
        targetLastMonth: 0, // no analyst issued a target in the last month
        targetLastQuarter: 120,
        ticker: 'AAA',
      },
    ]);
    expect(row.revisionPct, 'no recent target → neutral, not -100%').toBe(0);
  });

  it('is order-independent: shuffled inputs produce the same ranking', () => {
    const inputs = [
      {
        epsForwardYear1: 68,
        epsForwardYear2: 133,
        movingAverage200: 415,
        price: 1213,
        rating: 'A-',
        targetConsensus: 1496,
        targetLastMonth: 1438,
        targetLastQuarter: 1389,
        ticker: 'MU',
      },
      {
        epsForwardYear1: 14,
        epsForwardYear2: 14,
        movingAverage200: 312,
        price: 343,
        rating: 'B+',
        targetConsensus: 411,
        targetLastMonth: 411,
        targetLastQuarter: 411,
        ticker: 'GOOGL',
      },
      {
        epsForwardYear1: 1.08,
        epsForwardYear2: 1.57,
        movingAverage200: 57,
        price: 132,
        rating: 'C-',
        targetConsensus: 91,
        targetLastMonth: 91,
        targetLastQuarter: 95,
        ticker: 'INTC',
      },
    ];
    const forward = computeScorecard(inputs).map(r => r.ticker);
    const reversed = computeScorecard([...inputs].reverse()).map(r => r.ticker);
    expect(forward).toEqual(reversed);
  });
});

describe('selectForwardEps', () => {
  const estimates = [
    {date: '2024-08-28', epsAvg: 1.21},
    {date: '2025-08-28', epsAvg: 8.09},
    {date: '2026-08-28', epsAvg: 68.12},
    {date: '2027-08-28', epsAvg: 133.02},
  ];

  it('picks the two nearest fiscal years after now', () => {
    const result = selectForwardEps(estimates, new Date('2026-06-26T00:00:00Z'));
    expect(result).toEqual({epsForwardYear1: 68.12, epsForwardYear2: 133.02});
  });

  it('ignores the ordering of the input list', () => {
    const result = selectForwardEps([...estimates].reverse(), new Date('2026-06-26T00:00:00Z'));
    expect(result).toEqual({epsForwardYear1: 68.12, epsForwardYear2: 133.02});
  });

  it('throws when fewer than two forward years are available', () => {
    expect(() => selectForwardEps(estimates, new Date('2027-01-01T00:00:00Z'))).toThrow(
      /at least two forward estimates/
    );
  });
});
