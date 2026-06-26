/**
 * Deterministic "am I too late?" scorecard for momentum names.
 *
 * The rubric exists to answer one question — has a stock already run past the point of a sensible
 * entry? — so every band rewards room left (upside, low extension, reasonable valuation, growth,
 * and analysts still raising targets) and punishes a stretched, priced-for-perfection chart. A
 * falling-knife guard demotes names that have broken below their 50-day, where a stale analyst
 * target makes the upside look deceptively good. Same inputs always yield the same ranking; a
 * stock's score never depends on the others in the list.
 */

/** Raw, per-ticker inputs the rubric scores. The orchestrator fills these from the data provider. */
export interface ScorecardInput {
  ticker: string;
  price: number;
  /** 50-day moving average. A momentum name losing it signals a broken short-term trend. */
  movingAverage50: number;
  movingAverage200: number;
  targetConsensus: number;
  /** Average EPS estimate for the nearest forward fiscal year. */
  epsForwardYear1: number;
  /** Average EPS estimate for the fiscal year after that. */
  epsForwardYear2: number;
  /** Aggregate analyst letter grade (e.g. "A-", "B+", "C"). */
  rating: string;
  /** Average analyst price target as of last month — for estimate-revision momentum. */
  targetLastMonth: number;
  /** Average analyst price target as of last quarter — the baseline the last month is compared against. */
  targetLastQuarter: number;
}

export interface ScorecardRow {
  ticker: string;
  price: number;
  /** Upside to the consensus target, in percent. Negative means price already overshot the target. */
  upsidePct: number;
  /** Price over nearest-year EPS. `null` when that EPS is not positive (loss-making). */
  forwardPE: number | null;
  /** Year-2 vs year-1 EPS growth, in percent. `null` when year-1 EPS is not positive. */
  epsGrowthPct: number | null;
  /** Distance above the 200-day moving average, in percent. The primary "too late" gauge. */
  extensionPct: number;
  rating: string;
  /** Recent change in the average target (last month vs last quarter), in percent. Positive = analysts raising. */
  revisionPct: number;
  /** True when price has dropped well below its 50-day MA — a broken trend that makes the target/upside stale. */
  trendBroken: boolean;
  /** Sum of the rubric bands plus the trend-break guard; higher means more room left (less likely too late). */
  score: number;
}

export function scoreUpside(upsidePct: number) {
  if (upsidePct > 15) {
    return 2;
  }
  if (upsidePct >= 0) {
    return 1;
  }
  if (upsidePct >= -10) {
    return 0;
  }
  return -2;
}

export function scoreExtension(extensionPct: number) {
  if (extensionPct < 25) {
    return 2;
  }
  if (extensionPct < 60) {
    return 1;
  }
  if (extensionPct <= 100) {
    return 0;
  }
  return -2;
}

export function scoreForwardPE(forwardPE: number | null) {
  if (forwardPE === null || forwardPE <= 0) {
    return -1; // loss-making — no meaningful multiple
  }
  if (forwardPE < 20) {
    return 2;
  }
  if (forwardPE < 40) {
    return 1;
  }
  if (forwardPE <= 60) {
    return 0;
  }
  return -1;
}

export function scoreGrowth(epsGrowthPct: number | null) {
  if (epsGrowthPct === null) {
    return -2; // loss-making — growth not meaningful
  }
  if (epsGrowthPct > 40) {
    return 2;
  }
  if (epsGrowthPct >= 15) {
    return 1;
  }
  if (epsGrowthPct >= 0) {
    return 0;
  }
  return -2;
}

export function scoreRating(rating: string) {
  const grade = rating.trim().charAt(0).toUpperCase();
  if (grade === 'A') {
    return 1;
  }
  if (grade === 'B') {
    return 0;
  }
  return -1; // C or worse, or unrecognized
}

/**
 * Estimate-revision momentum: the recent move in the average analyst target. This is the one band
 * that re-admits "trend" — rising targets are the fundamental tell that a move will persist rather
 * than exhaust, and it isn't captured by valuation, growth, or a composite sentiment score.
 */
export function scoreRevisionMomentum(revisionPct: number) {
  if (revisionPct >= 3) {
    return 2; // analysts raising targets fast
  }
  if (revisionPct >= 0.5) {
    return 1;
  }
  if (revisionPct > -0.5) {
    return 0; // roughly flat
  }
  return -2; // targets being cut — momentum fading
}

/** How far below its 50-day a name must fall to count as a broken trend rather than a normal wobble. */
const FALLING_KNIFE_THRESHOLD_PCT = -8;

/**
 * Falling-knife guard. A momentum name trades above its 50-day by definition; once it drops well
 * through it, the short-term trend has broken and — critically — the analyst target is now stale, so
 * the upside and extension bands read misleadingly bullish (a crash temporarily looks "cheaper and
 * less stretched"). The threshold keeps an ordinary 2–3% dip from tripping the penalty; only a real
 * break (a gap-down through the line) does, parking the name until the dust settles.
 */
export function scoreTrendBreak(price: number, movingAverage50: number) {
  const belowFiftyDayPct = movingAverage50 > 0 ? (price / movingAverage50 - 1) * 100 : 0;
  return belowFiftyDayPct < FALLING_KNIFE_THRESHOLD_PCT ? -3 : 0;
}

function toRow(input: ScorecardInput): ScorecardRow {
  const upsidePct = (input.targetConsensus / input.price - 1) * 100;
  const extensionPct = (input.price / input.movingAverage200 - 1) * 100;
  const forwardPE = input.epsForwardYear1 > 0 ? input.price / input.epsForwardYear1 : null;
  const epsGrowthPct = input.epsForwardYear1 > 0 ? (input.epsForwardYear2 / input.epsForwardYear1 - 1) * 100 : null;
  /*
   * Both must be present: a zero last-month target means "no target issued recently" (missing data),
   * not a 100% cut, so it scores neutral rather than getting hammered.
   */
  const revisionPct =
    input.targetLastMonth > 0 && input.targetLastQuarter > 0
      ? (input.targetLastMonth / input.targetLastQuarter - 1) * 100
      : 0;

  const trendBreakPenalty = scoreTrendBreak(input.price, input.movingAverage50);
  const trendBroken = trendBreakPenalty < 0;

  const score =
    scoreUpside(upsidePct) +
    scoreExtension(extensionPct) +
    scoreForwardPE(forwardPE) +
    scoreGrowth(epsGrowthPct) +
    scoreRating(input.rating) +
    scoreRevisionMomentum(revisionPct) +
    trendBreakPenalty;

  return {
    epsGrowthPct,
    extensionPct,
    forwardPE,
    price: input.price,
    rating: input.rating,
    revisionPct,
    score,
    ticker: input.ticker,
    trendBroken,
    upsidePct,
  };
}

/**
 * Scores each input against the rubric and returns the rows best-first. Ties break by upside, then
 * ticker, so the ordering is fully determined by the inputs.
 */
export function computeScorecard(inputs: ScorecardInput[]): ScorecardRow[] {
  return inputs
    .map(toRow)
    .sort((a, b) => b.score - a.score || b.upsidePct - a.upsidePct || a.ticker.localeCompare(b.ticker));
}

/**
 * Picks the two nearest forward fiscal years from a provider's estimate list. Anchored to an
 * injected `now` rather than the wall clock so the selection is reproducible in tests.
 */
export function selectForwardEps(estimates: {date: string; epsAvg: number}[], now: Date) {
  const future = estimates
    .filter(estimate => new Date(estimate.date).getTime() > now.getTime())
    .sort((a, b) => a.date.localeCompare(b.date));

  const [year1, year2] = future;
  if (!year1 || !year2) {
    throw new Error(`Need at least two forward estimates after ${now.toISOString()}, found ${future.length}.`);
  }

  return {epsForwardYear1: year1.epsAvg, epsForwardYear2: year2.epsAvg};
}
