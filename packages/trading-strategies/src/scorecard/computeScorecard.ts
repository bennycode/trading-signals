/**
 * Deterministic "am I too late?" scorecard for momentum names.
 *
 * The rubric exists to answer one question — has a stock already run past the point of a sensible
 * entry? — so every band rewards room left (upside, low extension, reasonable valuation, growth)
 * and punishes a stretched, priced-for-perfection chart. Same inputs always yield the same ranking;
 * a stock's score never depends on the others in the list.
 */

/** Raw, per-ticker inputs the rubric scores. The orchestrator fills these from the data provider. */
export interface ScorecardInput {
  ticker: string;
  price: number;
  movingAverage200: number;
  targetConsensus: number;
  /** Average EPS estimate for the nearest forward fiscal year. */
  epsForwardYear1: number;
  /** Average EPS estimate for the fiscal year after that. */
  epsForwardYear2: number;
  /** Aggregate analyst letter grade (e.g. "A-", "B+", "C"). */
  rating: string;
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
  /** Sum of the five rubric bands; higher means more room left (less likely to be too late). */
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

function toRow(input: ScorecardInput): ScorecardRow {
  const upsidePct = (input.targetConsensus / input.price - 1) * 100;
  const extensionPct = (input.price / input.movingAverage200 - 1) * 100;
  const forwardPE = input.epsForwardYear1 > 0 ? input.price / input.epsForwardYear1 : null;
  const epsGrowthPct = input.epsForwardYear1 > 0 ? (input.epsForwardYear2 / input.epsForwardYear1 - 1) * 100 : null;

  const score =
    scoreUpside(upsidePct) +
    scoreExtension(extensionPct) +
    scoreForwardPE(forwardPE) +
    scoreGrowth(epsGrowthPct) +
    scoreRating(input.rating);

  return {
    epsGrowthPct,
    extensionPct,
    forwardPE,
    price: input.price,
    rating: input.rating,
    score,
    ticker: input.ticker,
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
