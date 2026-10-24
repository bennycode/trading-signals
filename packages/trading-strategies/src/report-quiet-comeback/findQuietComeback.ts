/** Trading days examined for the climb; only {@link QuietComebackParams.minUpDays} is tunable. */
const GRIND_WINDOW = 6;

/**
 * Biggest one-day rise in the grind window above which a stock reached its level materially more
 * often — the only predictive result in RESEARCH.md that reproduced on data it was not fitted to.
 * It predicts the crossing and not the return.
 */
export const LIKELY_TO_CROSS_STEP = 0.025;

/** A stock that went quiet below a high, fell away from it, and is climbing back without reaching it. */
export interface QuietComebackCandidate {
  close: number;
  /** Negative: the fall from {@link level} down to the lowest close since. */
  drawdown: number;
  /** Fraction of that fall recovered per day since the low. */
  gainPerDay: number;
  /** Negative: how far below {@link level} the stock still trades. */
  gapToLevel: number;
  /** See {@link LIKELY_TO_CROSS_STEP}; says nothing about the return. */
  likelyToCross: boolean;
  level: number;
  quietDays: number;
  riseDays: number;
  symbol: string;
}

export interface QuietComebackParams {
  lookbackDays: number;
  /** Rejects a level the stock merely drifted under, which would otherwise swamp the list. */
  maxGapToLevel: number;
  /** Makes the level significant by requiring the stock to have actually fallen from it. */
  minDrawdown: number;
  minQuietDays: number;
  /** Rises required within the last {@link GRIND_WINDOW} days. */
  minUpDays: number;
}

export const QUIET_COMEBACK_DEFAULTS: QuietComebackParams = {
  lookbackDays: 250,
  maxGapToLevel: 0.04,
  minDrawdown: 0.08,
  minQuietDays: 60,
  minUpDays: 4,
};

/**
 * Evaluates the most recent close against the setup, returning `undefined` when it does not
 * qualify. The level is whichever high tops the lookback window, so it is any high of magnitude
 * rather than an all-time high.
 *
 * Closes must be split- and spin-off-adjusted. On a raw series a split leaves a fictional level at
 * the pre-split price, which drops the affected stock silently instead of reporting a bogus
 * candidate, and makes every figure derived from the level meaningless meanwhile.
 */
export function findQuietComeback(
  symbol: string,
  closes: readonly number[],
  config: QuietComebackParams = QUIET_COMEBACK_DEFAULTS
): QuietComebackCandidate | undefined {
  const {lookbackDays, maxGapToLevel, minDrawdown, minQuietDays, minUpDays} = config;
  const last = closes.length - 1;
  if (last < lookbackDays) {
    return undefined;
  }

  const level = Math.max(...closes.slice(last - lookbackDays, last));
  let lastAtLevel = -1;
  for (let index = last - 1; index >= last - lookbackDays; index--) {
    if (closes[index] >= level) {
      lastAtLevel = index;
      break;
    }
  }
  const quietDays = last - lastAtLevel;
  if (quietDays < minQuietDays) {
    return undefined;
  }

  let bottom = Infinity;
  let bottomIndex = lastAtLevel;
  for (let index = lastAtLevel; index < last; index++) {
    if (closes[index] < bottom) {
      bottom = closes[index];
      bottomIndex = index;
    }
  }
  const drawdown = (level - bottom) / level;
  if (drawdown < minDrawdown) {
    return undefined;
  }

  const gapToLevel = (closes[last] - level) / level;
  if (gapToLevel >= 0 || gapToLevel < -maxGapToLevel) {
    return undefined;
  }

  let upDays = 0;
  let maxStep = -Infinity;
  for (let index = last - GRIND_WINDOW + 1; index <= last; index++) {
    const step = closes[index] / closes[index - 1] - 1;
    maxStep = Math.max(maxStep, step);
    if (step > 0) {
      upDays++;
    }
  }
  if (upDays < minUpDays) {
    return undefined;
  }

  const riseDays = Math.max(last - bottomIndex, 1);
  return {
    close: closes[last],
    drawdown: -drawdown,
    gainPerDay: (closes[last] / bottom - 1) / riseDays,
    gapToLevel,
    level,
    likelyToCross: maxStep > LIKELY_TO_CROSS_STEP,
    quietDays,
    riseDays,
    symbol,
  };
}

/**
 * Fastest recoveries first, with the slowest tail dropped: the slowest decile underperformed while
 * the fastest only matched the market, so ranking earns its place by excluding laggards rather than
 * by promising the leaders outperform. See RESEARCH.md.
 */
export function rankQuietComebacks(
  candidates: readonly QuietComebackCandidate[],
  slowestShare = 0.3
): QuietComebackCandidate[] {
  const ranked = [...candidates].sort((a, b) => b.gainPerDay - a.gainPerDay);
  const keep = ranked.length - Math.floor(ranked.length * slowestShare);
  return ranked.slice(0, Math.max(keep, 1));
}
