import type {StringValue} from 'ms';

/*
 * What the card asks, what each answer is worth, and how a total becomes a verdict. Kept apart
 * from the machinery that reads it off bars, so a weight or a band edge can be argued with
 * without reading the indicator plumbing.
 */

/** Kind of evidence a check draws on, used to tell broad agreement from one loud voice. */
export type WeaknessCategory = 'momentum' | 'relative' | 'trend' | 'volatility' | 'volume';

export type WeaknessCheckName =
  | 'atrExpandingWhileFalling'
  | 'bearishDivergence'
  | 'belowFallingFastAverage'
  | 'deathCross'
  | 'distribution'
  | 'lowerBandRide'
  | 'lowerHighsAndLows'
  | 'macdBelowZero'
  | 'relativeStrength'
  | 'rsiBearRange'
  | 'volumeLineFalling';

/**
 * One comparison a check made, kept so a reader can see whether it missed by a mile or by a hair.
 * A bare `fired: false` cannot be reviewed: price 25% under a still-rising average and price a
 * cent under it are the same answer until the numbers are on the page.
 */
export type WeaknessMeasure = {
  /**
   * How far {@link WeaknessMeasure.reading} sits from {@link WeaknessMeasure.limit}, in percent of
   * the limit, rounded to two decimals because it is read rather than computed with. Negative means
   * below the limit. `null` where a percentage would be meaningless, as against a zero line.
   */
  deviationPercent: number | null;
  /**
   * Which instrument of the card the reading comes off, named as a trader would say it: `SMA 50`,
   * `RSI 14`, `MACD`, `OBV`. It carries the period, since every one of them is configurable and a
   * row that says `SMA 50` about a 20-bar average would be a lie.
   */
  indicator: string;
  /** What the two numbers are, short enough to scan down a column. */
  label: string;
  /** The line this check watches: an average, a band, a threshold, or the window's own opening. */
  limit: number;
  reading: number;
};

export type WeaknessCheck = {
  category: WeaknessCategory;
  /**
   * `null` when the window held nothing to read the check against, which is not the same answer as
   * `false`: an unread check deducts nothing, so it flatters the score by its own weight.
   */
  fired: boolean | null;
  /** Empty for a check that could not be read at all, since it compared nothing. */
  measures: WeaknessMeasure[];
  /**
   * The check in plain words, as a question whose "yes" is the bad answer. {@link
   * WeaknessCheck.name} stays the domain term a trader would look up, such as a death cross; this
   * is what it means for anyone reading the card rather than maintaining it.
   */
  question: string;
  name: WeaknessCheckName;
  weight: number;
};

export type WeaknessVerdict = 'distribution' | 'downtrend' | 'noise' | 'weakening';

export type HealthReport = {
  /**
   * Open of the last bar the checks read. A score with no date on it cannot be compared with the
   * next one, and a feed that withholds the session still forming makes the latest bar older than
   * the moment of the reading.
   */
  asOf: string;
  checks: WeaknessCheck[];
  /**
   * What is left of a clean chart once the fired checks are deducted, out of 100. It reads like a
   * credit score: 100 is an instrument with nothing against it, 0 is one with the whole set
   * against it.
   */
  health: number;
  /**
   * Set when every check that fired draws on the same kind of evidence, and `null` once two or
   * more kinds agree. One category talking to itself is weaker than its total suggests, which is
   * the judgement a plain number cannot carry.
   */
  soleCategory: WeaknessCategory | null;
  /** Bar size the checks were read on, so a stored reading says what it is a reading of. */
  timeframe: StringValue;
  /**
   * Weight of the checks that had nothing to read, so {@link HealthReport.health} is optimistic by
   * up to this many points. A reading of 60 with 15 unread covers everything from 45 to 60.
   */
  unreadWeight: number;
  verdict: WeaknessVerdict;
};

/** Health of an instrument with no check against it, which every fired check deducts from. */
export const FULL_HEALTH = 100;

/**
 * Every check the card reads, with the plain question it answers and what a "yes" deducts from full
 * health. A check weighs more when it is hard to argue with on its own terms: price making lower
 * highs and lower lows needs no parameter and no threshold, while a single tag of a Bollinger band
 * is as often a bounce as a breakdown.
 *
 * The questions are worded so that "yes" is always the bad answer, because a reader scanning a card
 * should not have to work out which way each check points.
 *
 * The ten checks read from the instrument's own bars are a closed budget of 100. Relative strength
 * deducts on top of that budget rather than inside it, and health is floored at 0: a card given a
 * benchmark must not read a breakdown as healthier than the same card without one.
 */
export const CHECKS = [
  {
    category: 'relative',
    name: 'relativeStrength',
    question: 'Is it losing ground to its benchmark?',
    weight: 15,
  },
  {
    category: 'trend',
    name: 'lowerHighsAndLows',
    question: 'Is price making lower highs and lower lows?',
    weight: 18,
  },
  {
    category: 'trend',
    name: 'belowFallingFastAverage',
    question: 'Is price below a fast average that has turned down?',
    weight: 12,
  },
  {
    category: 'trend',
    name: 'deathCross',
    question: 'Has the fast average crossed below the slow one?',
    weight: 10,
  },
  {
    category: 'momentum',
    name: 'rsiBearRange',
    question: 'Does momentum stall short of overbought and reach oversold?',
    weight: 9,
  },
  {
    category: 'momentum',
    name: 'macdBelowZero',
    question: 'Has MACD crossed below zero and below its signal?',
    weight: 8,
  },
  {
    category: 'momentum',
    name: 'bearishDivergence',
    question: 'Is a new high being made on less force than the last one?',
    weight: 8,
  },
  {
    category: 'volume',
    name: 'distribution',
    question: 'Is trade heavier on down bars than on up bars?',
    weight: 13,
  },
  {
    category: 'volume',
    name: 'volumeLineFalling',
    question: 'Is the volume line falling while price holds up?',
    weight: 12,
  },
  {
    category: 'volatility',
    name: 'atrExpandingWhileFalling',
    question: 'Are ranges widening as price falls?',
    weight: 6,
  },
  {
    category: 'volatility',
    name: 'lowerBandRide',
    question: 'Is price pinned to the lower band of a widening range?',
    weight: 4,
  },
] as const satisfies readonly {
  category: WeaknessCategory;
  name: WeaknessCheckName;
  question: string;
  weight: number;
}[];

/**
 * Highest health that still reads as the named verdict, healthiest band first. No category can
 * deduct enough on its own to drag health down into the "downtrend" band, so a confirmed reading
 * always means that more than one kind of evidence agreed.
 */
const BANDS = [
  {minHealth: 76, verdict: 'noise'},
  {minHealth: 51, verdict: 'weakening'},
  {minHealth: 26, verdict: 'downtrend'},
  {minHealth: 0, verdict: 'distribution'},
] as const satisfies readonly {minHealth: number; verdict: WeaknessVerdict}[];

/**
 * In a downtrend the index tops out well short of overbought on rallies and reaches oversold on
 * dips. Those two ceilings are what "the index sits in its bear range" means, as opposed to the
 * midline crossing that fires in any flat market.
 */
export const BEAR_RANGE_CEILING = 60;
export const BEAR_RANGE_FLOOR = 30;

export function classifyChartHealth(health: number): WeaknessVerdict {
  const band = BANDS.find(candidate => health >= candidate.minHealth);
  return band ? band.verdict : 'distribution';
}

/** A check's verdict together with the comparisons it reached that verdict on. */
export type Reading = {fired: boolean | null; measures: WeaknessMeasure[]};

/** A check the window held nothing to read: it compared nothing, so it shows no numbers. */
export const UNREAD: Reading = {fired: null, measures: []};

export function measure(indicator: string, label: string, reading: number, limit: number): WeaknessMeasure {
  const deviation = limit === 0 ? null : ((reading - limit) / Math.abs(limit)) * 100;

  return {
    deviationPercent: deviation === null ? null : Math.round(deviation * 100) / 100,
    indicator,
    label,
    limit,
    reading,
  };
}

export function soleCategory(checks: readonly WeaknessCheck[]) {
  const categories = new Set(checks.filter(check => check.fired === true).map(check => check.category));
  const [only] = categories;

  return categories.size === 1 && only ? only : null;
}
