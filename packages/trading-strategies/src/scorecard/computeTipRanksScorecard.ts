import {scoreExtension, scoreUpside} from './computeScorecard.js';

/**
 * A TipRanks-only variant of the momentum scorecard. It keeps the two metrics TipRanks supplies
 * directly (upside to target, extension vs the 200-day MA) and swaps the forward-looking bands the
 * FMP version uses — forward P/E and EPS growth, which TipRanks does not expose — for TipRanks'
 * own signals: the Smart Score, the analyst consensus, and the (trailing) P/E. The result answers
 * "is the overall signal strong and is there room left?" rather than "is it cheap versus *future*
 * earnings?". Same inputs always yield the same ranking.
 */

export interface TipRanksScorecardInput {
  ticker: string;
  price: number;
  movingAverage200: number;
  targetConsensus: number;
  /** TipRanks Smart Score, 1–10. */
  smartScore: number;
  /** Analyst consensus label, e.g. "Strong Buy", "Hold", "Sell". Spacing/case are ignored. */
  consensus: string;
  /** Trailing P/E (TipRanks has no forward EPS, so this stands in for the FMP forward multiple). */
  trailingPE: number;
}

export interface TipRanksScorecardRow {
  ticker: string;
  price: number;
  upsidePct: number;
  extensionPct: number;
  smartScore: number;
  consensus: string;
  trailingPE: number;
  score: number;
}

export function scoreSmartScore(smartScore: number) {
  if (smartScore >= 8) {
    return 2; // TipRanks "Outperform" band
  }
  if (smartScore >= 6) {
    return 1;
  }
  if (smartScore >= 4) {
    return 0;
  }
  return -2; // "Underperform"
}

export function scoreConsensus(consensus: string) {
  const normalized = consensus.replace(/\s+/g, '').toLowerCase();
  if (normalized === 'strongbuy') {
    return 2;
  }
  if (normalized.endsWith('buy')) {
    return 1; // "Buy" / "Moderate Buy"
  }
  if (normalized === 'hold' || normalized === 'neutral') {
    return 0;
  }
  return -2; // any flavour of sell
}

export function scoreTrailingPE(trailingPE: number) {
  if (trailingPE <= 0) {
    return -1; // loss-making — no meaningful multiple
  }
  if (trailingPE < 25) {
    return 2;
  }
  if (trailingPE < 50) {
    return 1;
  }
  if (trailingPE <= 80) {
    return 0;
  }
  return -1;
}

function toRow(input: TipRanksScorecardInput): TipRanksScorecardRow {
  const upsidePct = (input.targetConsensus / input.price - 1) * 100;
  const extensionPct = (input.price / input.movingAverage200 - 1) * 100;

  const score =
    scoreUpside(upsidePct) +
    scoreExtension(extensionPct) +
    scoreSmartScore(input.smartScore) +
    scoreConsensus(input.consensus) +
    scoreTrailingPE(input.trailingPE);

  return {
    consensus: input.consensus,
    extensionPct,
    price: input.price,
    score,
    smartScore: input.smartScore,
    ticker: input.ticker,
    trailingPE: input.trailingPE,
    upsidePct,
  };
}

/**
 * Scores each input against the TipRanks rubric, best-first, with the same stable tiebreaks as the
 * FMP scorecard (score → upside → ticker) so the two rankings are directly comparable.
 */
export function computeTipRanksScorecard(inputs: TipRanksScorecardInput[]): TipRanksScorecardRow[] {
  return inputs
    .map(toRow)
    .sort((a, b) => b.score - a.score || b.upsidePct - a.upsidePct || a.ticker.localeCompare(b.ticker));
}
