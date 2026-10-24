/**
 * A stock that spent weeks or months below a high it had previously reached, fell meaningfully away from
 * it, and has now started climbing back toward it without having reached it yet.
 *
 * The level is whichever high sits at the top of the lookback window, so it is "a high of
 * magnitude" rather than an all-time high: {@link QuietComebackParams.minDrawdown} is what makes
 * it significant, by requiring the stock to have actually fallen away from it.
 */
export interface QuietComebackCandidate {
  /** Fraction of the fall recovered per day since the low; see {@link QuietComebackParams}. */
  gainPerDay: number;
  /** Negative: how far below {@link level} the stock still trades. */
  gapToLevel: number;
  close: number;
  /** Negative: the fall from {@link level} down to the lowest close since. */
  drawdown: number;
  /**
   * Whether the stock is in the group that historically reached its level far more often; see
   * {@link LIKELY_TO_CROSS_STEP}. It says nothing about what the stock returns.
   */
  likelyToCross: boolean;
  level: number;
  quietDays: number;
  /** Largest single-day rise in the grind window, the input to {@link QuietComebackCandidate.likelyToCross}. */
  recentMaxStep: number;
  riseDays: number;
  symbol: string;
}

export interface QuietComebackParams {
  grindWindow: number;
  lookbackDays: number;
  /** Rejects a level the stock merely drifted under, which would otherwise swamp the list. */
  maxGapToLevel: number;
  minDrawdown: number;
  minQuietDays: number;
  minUpDays: number;
}

/**
 * Biggest one-day rise in the grind window above which a stock reached its level materially more
 * often. Measured 2016-2026: with a 10-day patience the cross rate rose from 44.8% to 51.3% on the
 * half of the S&P 500 sample the threshold was not fitted on, and from 45.0% to 52.2% on an
 * independent mid-cap universe, and from 45.7% to 53.3% on a further 1,235 symbols and 9,895
 * setups that no threshold here was fitted on.
 *
 * It predicts the crossing only. Over the same samples the excess return of the filtered group was
 * +0.06% and -0.46% per month (t = 0.17 and -0.62), and +0.13% (t = 0.47) across the 9,895 fresh
 * setups — a bigger daily range carries a stock across the remaining gap and moves it just as far
 * the other way, so the higher hit rate pays nothing.
 */
export const LIKELY_TO_CROSS_STEP = 0.025;

export const QUIET_COMEBACK_DEFAULTS: QuietComebackParams = {
  grindWindow: 6,
  lookbackDays: 250,
  maxGapToLevel: 0.04,
  minDrawdown: 0.08,
  minQuietDays: 60,
  minUpDays: 4,
};

/**
 * Evaluates the most recent close in `closes` against the setup, returning `undefined` when it
 * does not qualify. Only closes are needed, so a caller may pass an adjusted series directly.
 *
 * Bars must be split- and spin-off-adjusted. On a raw series a split leaves a fictional level
 * behind at the pre-split price, so an affected stock sits far below it and is dropped by
 * {@link QuietComebackParams.maxGapToLevel} — the failure is a silent exclusion rather than a
 * bogus candidate, and every figure derived from the level is meaningless meanwhile.
 */
export function findQuietComeback(
  symbol: string,
  closes: readonly number[],
  config: QuietComebackParams = QUIET_COMEBACK_DEFAULTS
): QuietComebackCandidate | undefined {
  const {grindWindow, lookbackDays, maxGapToLevel, minDrawdown, minQuietDays, minUpDays} = config;
  const last = closes.length - 1;
  if (last < lookbackDays) {
    return undefined;
  }

  const window = closes.slice(last - lookbackDays, last);
  const level = Math.max(...window);
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
  for (let index = last - grindWindow + 1; index <= last; index++) {
    if (closes[index] > closes[index - 1]) {
      upDays++;
    }
  }
  if (upDays < minUpDays) {
    return undefined;
  }

  const riseDays = Math.max(last - bottomIndex, 1);
  let recentMaxStep = -Infinity;
  for (let index = last - grindWindow + 1; index <= last; index++) {
    recentMaxStep = Math.max(recentMaxStep, closes[index] / closes[index - 1] - 1);
  }

  return {
    close: closes[last],
    drawdown: -drawdown,
    gainPerDay: (closes[last] / bottom - 1) / riseDays,
    gapToLevel,
    level,
    likelyToCross: recentMaxStep > LIKELY_TO_CROSS_STEP,
    quietDays,
    recentMaxStep,
    riseDays,
    symbol,
  };
}

/**
 * Ranks candidates so the fastest recoveries come first and drops the slowest tail.
 *
 * Measured over 2016-2026 on the S&P 500 and on an independent universe of mid-caps, the slowest
 * decile of recoveries underperformed its own month's universe by 0.74% over the following 21 days
 * (t = -2.94) while the fastest decile matched it. Ranking therefore earns its place by excluding
 * the laggards; it does not promise the leaders will outperform.
 */
export function rankQuietComebacks(
  candidates: readonly QuietComebackCandidate[],
  slowestShare = 0.3
): QuietComebackCandidate[] {
  const ranked = [...candidates].sort((a, b) => b.gainPerDay - a.gainPerDay);
  const keep = ranked.length - Math.floor(ranked.length * slowestShare);
  return ranked.slice(0, Math.max(keep, 1));
}
