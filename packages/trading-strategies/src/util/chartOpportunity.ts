import {getAverage, getMinimum, getPercentageChange} from 'trading-signals';
import type {Criterion, Score, ScoreCard} from '@typedtrader/scorecard';
import {BEAR_RANGE_FLOOR, DISTRIBUTION_MARGIN, UNREAD, measure, type Reading} from './chartHealthChecks.js';
import type {Bar} from './chartHealthReadings.js';

/*
 * The other side of the health card. That one asks what is wrong with a chart, and every answer it
 * can give is a deduction, so a chart that has fallen always reads badly. This one asks a question
 * a deduction cannot answer: whether the fall belongs to the market rather than to the instrument,
 * and whether it looks like a stretch rather than a breakdown.
 *
 * What it cannot tell you is whether the fall was deserved. That is a question about the business,
 * and no reading taken off price and volume reaches it.
 */

/** Kind of evidence a field draws on, so one loud voice is not mistaken for broad agreement. */
export type OpportunityCategory = 'momentum' | 'relative' | 'volatility' | 'volume';

export type OpportunityFieldName = 'fellWithMarket' | 'noDistribution' | 'orderlyRanges' | 'oversoldStretch';

export type OpportunityField = Criterion<OpportunityFieldName, OpportunityCategory>;

/**
 * `noDip` keeps the card from being read as a quality score: an instrument that did not fall has no
 * dip to buy, whatever the other fields say about it.
 */
export type OpportunityVerdict = 'breakdown' | 'dip' | 'mixed' | 'noDip';

export type OpportunityCard = ScoreCard<OpportunityField, OpportunityVerdict> & {
  /** The instrument's own return across the window, which is what the card is a reading about. */
  returnPercent: number;
};

/** Score of an instrument whose every field answers in its favour. */
export const FULL_OPPORTUNITY = 100;

/**
 * How far an instrument may lag its benchmark and still count as having fallen with it, in
 * percentage points. Without a tolerance the field is a knife edge: a name that fell within four
 * hundredths of a point of its index read as falling on its own, which is not a distinction anyone
 * would make looking at the two charts.
 */
export const MARKET_FALL_TOLERANCE_IN_PERCENT = 2;

/** At or above this the fall reads as a dip; below the lower edge it reads as a breakdown. */
export const OPPORTUNITY_BANDS = {
  breakdownBelow: 40,
  dipAtOrAbove: 70,
} as const;

/**
 * Every field the card reads, with the plain question it answers and what a "yes" is worth. Unlike
 * the health card, "yes" is the good answer here, which is why the card reports
 * `firedMeans: 'strength'`.
 *
 * The weights say which answers are hard to argue with. That the market fell too is the whole
 * premise of buying a dip, so it carries the most; that ranges stayed orderly and that sellers
 * never took control are corroboration, and each needs a threshold to be read at all.
 */
export const OPPORTUNITY_FIELDS = [
  {
    category: 'relative',
    name: 'fellWithMarket',
    question: 'Did the market fall with it, rather than it falling alone?',
    weight: 35,
  },
  {
    category: 'momentum',
    name: 'oversoldStretch',
    question: 'Has momentum stretched as far as oversold?',
    weight: 25,
  },
  {
    category: 'volatility',
    name: 'orderlyRanges',
    question: 'Did ranges stay as tight as they were before the fall?',
    weight: 20,
  },
  {
    category: 'volume',
    name: 'noDistribution',
    question: 'Did trade stay no heavier on down bars than on up bars?',
    weight: 20,
  },
] as const satisfies readonly {
  category: OpportunityCategory;
  name: OpportunityFieldName;
  question: string;
  weight: number;
}[];

export function classifyOpportunity(score: number, fell: boolean): OpportunityVerdict {
  if (!fell) {
    return 'noDip';
  }

  if (score >= OPPORTUNITY_BANDS.dipAtOrAbove) {
    return 'dip';
  }

  return score < OPPORTUNITY_BANDS.breakdownBelow ? 'breakdown' : 'mixed';
}

/**
 * Reads the card off a window of bars that already carry their indicator values, the same window
 * the health card reads, so the two cannot disagree about what the instrument did.
 */
export function readOpportunity({
  latest,
  oldest,
  periods,
  window,
}: {
  latest: Bar;
  oldest: Bar;
  periods: {rsi: number; trueRange: number};
  window: readonly Bar[];
}): Record<OpportunityFieldName, Reading> {
  const ownReturn = getPercentageChange(oldest.close, latest.close);
  const benchmarkFirst = oldest.relative === null ? null : oldest.close / oldest.relative;
  const benchmarkLast = latest.relative === null ? null : latest.close / latest.relative;
  const benchmarkReturn =
    benchmarkFirst === null || benchmarkLast === null || benchmarkFirst === 0
      ? null
      : getPercentageChange(benchmarkFirst, benchmarkLast);

  const upVolumes: number[] = [];
  const downVolumes: number[] = [];

  window.forEach((bar, index) => {
    const previous = window[index - 1];

    if (!previous) {
      return;
    }

    if (bar.close > previous.close) {
      upVolumes.push(bar.volume);
    } else if (bar.close < previous.close) {
      downVolumes.push(bar.volume);
    }
  });

  const downVolume = getAverage(downVolumes);
  const upVolume = getAverage(upVolumes);
  const oversoldLow = getMinimum(window.map(bar => bar.rsi));

  return {
    /*
     * An instrument that gave up no ground fell because its market did. The excess is what carries
     * the answer: a fall of any depth matched by the benchmark leaves it near zero, while the same
     * fall against a market that held leaves it deeply negative.
     */
    fellWithMarket:
      benchmarkReturn === null
        ? UNREAD
        : {
            fired: ownReturn <= 0 && ownReturn - benchmarkReturn >= -MARKET_FALL_TOLERANCE_IN_PERCENT,
            measures: [
              measure('Price', 'return vs benchmark return', ownReturn, benchmarkReturn),
              measure(
                'Relative',
                'excess return vs tolerance',
                ownReturn - benchmarkReturn,
                -MARKET_FALL_TOLERANCE_IN_PERCENT
              ),
            ],
          },
    /*
     * Sellers in control show up as weight on the down bars. The same margin the health card allows
     * before calling it distribution applies here, so the two read one tilt the same way.
     */
    noDistribution: {
      fired: downVolume <= upVolume * DISTRIBUTION_MARGIN,
      measures: [measure('Volume', 'down bars vs up bars', downVolume, upVolume * DISTRIBUTION_MARGIN)],
    },
    /*
     * Ranges that widen as price falls are the signature of a disorderly fall, which is the one kind
     * that keeps going. Holding its usual range says the fall was absorbed.
     */
    orderlyRanges: {
      fired: latest.atr <= oldest.atr,
      measures: [measure(`ATR ${periods.trueRange}`, 'range vs window start', latest.atr, oldest.atr)],
    },
    /*
     * A drift that never reaches oversold is not a stretch anyone is being paid to take the other
     * side of. It is the same floor the health card reads, from the other direction.
     */
    oversoldStretch: {
      fired: oversoldLow <= BEAR_RANGE_FLOOR,
      measures: [measure(`RSI ${periods.rsi}`, 'low vs oversold floor', oversoldLow, BEAR_RANGE_FLOOR)],
    },
  };
}

/** Totals the fields that answered in the instrument's favour. */
export function scoreOpportunity(fields: readonly OpportunityField[]): Score {
  const earned = fields.reduce((sum, field) => (field.fired === true ? sum + field.weight : sum), 0);

  return {kind: 'ratio', outOf: FULL_OPPORTUNITY, value: earned};
}
