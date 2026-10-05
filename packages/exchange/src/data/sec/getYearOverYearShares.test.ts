import {describe, expect, it} from 'vitest';
import {getYearOverYearShares} from './getYearOverYearShares.js';

function fact(accn: string, start: string, end: string, filed: string, val: number) {
  return {accn, end, filed, form: '10-Q', start, val};
}

/** A quarterly report filed in July 2026 that restates the same quarter of 2025 next to it. */
const JULY_FILING = [
  fact('q2-2026', '2026-01-01', '2026-06-30', '2026-07-23', 1_210),
  fact('q2-2026', '2026-04-01', '2026-06-30', '2026-07-23', 1_200),
  fact('q2-2026', '2025-04-01', '2025-06-30', '2026-07-23', 1_000),
];

/** The report filed a quarter earlier. */
const APRIL_FILING = [
  fact('q1-2026', '2026-01-01', '2026-03-31', '2026-04-30', 1_150),
  fact('q1-2026', '2025-01-01', '2025-03-31', '2026-04-30', 990),
];

describe('getYearOverYearShares', () => {
  it('compares the latest quarter with the same quarter a year earlier', () => {
    expect(getYearOverYearShares([...APRIL_FILING, ...JULY_FILING], new Date('2026-10-01'))).toEqual({
      current: 1_200,
      yearAgo: 1_000,
    });
  });

  it('uses only filings that were public on the given day', () => {
    expect(
      getYearOverYearShares([...APRIL_FILING, ...JULY_FILING], new Date('2026-06-01')),
      'the July report did not exist yet'
    ).toEqual({current: 1_150, yearAgo: 990});
  });

  it('takes both quarters from the same filing, so a split in between does not read as dilution', () => {
    const originalYearAgo = fact('q2-2025', '2025-04-01', '2025-06-30', '2025-07-24', 100);
    const afterSplit = [
      fact('q2-2026', '2026-04-01', '2026-06-30', '2026-07-23', 1_200),
      fact('q2-2026', '2025-04-01', '2025-06-30', '2026-07-23', 1_000),
    ];

    expect(getYearOverYearShares([originalYearAgo, ...afterSplit], new Date('2026-10-01'))).toEqual({
      current: 1_200,
      yearAgo: 1_000,
    });
  });

  it('is unknown when the latest filing does not restate the year-ago quarter', () => {
    expect(getYearOverYearShares(APRIL_FILING.slice(0, 1), new Date('2026-10-01'))).toBeNull();
  });

  it('is unknown before anything was filed', () => {
    expect(getYearOverYearShares(JULY_FILING, new Date('2026-01-01'))).toBeNull();
  });

  it('ignores annual and point-in-time values', () => {
    const annual = fact('fy-2025', '2025-01-01', '2025-12-31', '2026-02-05', 5_000);
    const instant = {accn: 'cover', end: '2026-07-15', filed: '2026-07-23', form: '10-Q', val: 9_999};

    expect(getYearOverYearShares([annual, instant], new Date('2026-10-01'))).toBeNull();
  });
});
