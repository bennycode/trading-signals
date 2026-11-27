import {getAverage} from 'trading-signals';
import type {StringValue} from 'ms';
import type {Criterion, Measurement, Score, ScoreCard} from '@typedtrader/scorecard';

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
  | 'brokenBelowFastAverage'
  | 'distribution'
  | 'lowerHighsAndLows'
  | 'relativeStrength'
  | 'rsiBearRange'
  | 'volumeLineFalling';

/** One comparison a check made, kept so a reader can see whether it missed by a mile or a hair. */
export type WeaknessMeasure = Measurement;

/**
 * One check of the card: the question, what a "yes" is worth, and the measurements behind the
 * answer. Every question is worded so that "yes" is the bad answer, which the card states once as
 * {@link ScoreCard.firedMeans} rather than leaving each reader to work out which way it points.
 */
export type WeaknessCheck = Criterion<WeaknessCheckName, WeaknessCategory>;

export type WeaknessVerdict = 'distribution' | 'downtrend' | 'noise' | 'weakening';

/**
 * What the card answers for one instrument: a weakness score out of 100 with the checks that
 * produced it, plus the two readings a plain number cannot carry.
 */
export type HealthReport = ScoreCard<WeaknessCheck, WeaknessVerdict> & {
  /** Every check reads against the instrument's own chart, so there is always a score. */
  score: Score;
  /**
   * Set when every check that fired draws on the same kind of evidence, and `null` once two or
   * more kinds agree. One category talking to itself is weaker than its total suggests.
   */
  soleCategory: WeaknessCategory | null;
  /** Bar size the checks were read on, so a stored reading says what it is a reading of. */
  timeframe: StringValue;
};

/** Health of an instrument with no check against it, which every fired check deducts from. */
export const FULL_HEALTH = 100;

/**
 * Every check the card reads, with the plain question it answers and what a "yes" deducts from full
 * health. A check weighs more when it is hard to argue with on its own terms: price making lower
 * highs and lower lows needs no parameter and no threshold, while an average range that widens
 * needs a period and a window to be read at all.
 *
 * The questions are worded so that "yes" is always the bad answer, because a reader scanning a card
 * should not have to work out which way each check points.
 *
 * Each one has to tell the reader something the others do not. A moving-average cross and a MACD
 * zero line both restate where price sits against its own averages, which two checks here already
 * read and read earlier, so neither is on the card; a tag of a Bollinger band is as often a bounce
 * as a breakdown, so that is not either.
 *
 * The seven checks read from the instrument's own bars are a closed budget of 100. Relative
 * strength deducts on top of that budget rather than inside it, and health is floored at 0: a card
 * given a benchmark must not read a breakdown as healthier than the same card without one.
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
    weight: 23,
  },
  {
    category: 'trend',
    name: 'brokenBelowFastAverage',
    question: 'Has price broken below its fast average?',
    weight: 15,
  },
  {
    category: 'momentum',
    name: 'rsiBearRange',
    question: 'Does momentum stall short of overbought and reach oversold?',
    weight: 12,
  },
  {
    category: 'momentum',
    name: 'bearishDivergence',
    question: 'Is a new high being made on less force than the last one?',
    weight: 10,
  },
  {
    category: 'volume',
    name: 'distribution',
    question: 'Is trade heavier on down bars than on up bars?',
    weight: 17,
  },
  {
    category: 'volume',
    name: 'volumeLineFalling',
    question: 'Is the volume line falling while price holds up?',
    weight: 15,
  },
  {
    category: 'volatility',
    name: 'atrExpandingWhileFalling',
    question: 'Are ranges widening as price falls?',
    weight: 8,
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

/**
 * How much heavier trade on down bars has to be before {@link CHECKS} counts it as distribution.
 *
 * A bare "more than" makes the check a coin flip whenever the two averages are close, and 17 points
 * is too much to hand to a tie: a reading of 2% more volume on down bars is one heavy session away
 * from reading 2% less. A tenth more volume on the down bars of a whole window is a tilt a reader
 * can defend. Reasoned rather than fitted, like the weights it guards.
 */
export const DISTRIBUTION_MARGIN = 0.1;

/**
 * How far below a still-rising fast average price has to fall, in average ranges, before
 * {@link CHECKS} calls it a break rather than a pullback.
 *
 * Measured in {@link ATR} rather than in percent so the same test means the same thing on a quiet
 * utility and on a chip maker: one average range is a normal day, and a price two of them under its
 * own average has not had a normal day. Without it the check waits for the average to turn, which
 * on a 50-bar average means waiting weeks after a break the chart already shows.
 */
export const FAST_AVERAGE_BREAK_IN_ATR = 2;

export function classifyChartHealth(health: number): WeaknessVerdict {
  const band = BANDS.find(candidate => health >= candidate.minHealth);
  return band ? band.verdict : 'distribution';
}

/** A check's verdict together with the comparisons it reached that verdict on. */
export type Reading = {fired: boolean | null; measures: WeaknessMeasure[]};

/** A check the window held nothing to read: it compared nothing, so it shows no numbers. */
export const UNREAD: Reading = {fired: null, measures: []};

/**
 * The two numbers a volume tilt compares, or `null` where the window holds no bars of one kind and
 * there is nothing to compare, which a relentless decline produces. Both cards read the tilt from
 * here so that the line between heavy and ordinary down-bar trade is drawn once: a weakness card
 * asking whether sellers were in control and an opportunity card asking whether they were not have
 * to agree on where that line sits, or one of them contradicts the other on the same window.
 */
export function readVolumeTilt(
  downVolumes: number[],
  upVolumes: number[]
): {downVolume: number; heavyLine: number} | null {
  if (downVolumes.length === 0 || upVolumes.length === 0) {
    return null;
  }

  return {
    downVolume: getAverage(downVolumes),
    heavyLine: getAverage(upVolumes) * (1 + DISTRIBUTION_MARGIN),
  };
}

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
