import {getAverage, getMaximum, getMinimum} from 'trading-signals';
import {
  BEAR_RANGE_CEILING,
  BEAR_RANGE_FLOOR,
  DISTRIBUTION_MARGIN,
  FAST_AVERAGE_BREAK_IN_ATR,
  UNREAD,
  measure,
  type Reading,
  type WeaknessCheckName,
} from './chartHealthChecks.js';

/** What the checks need to know about one bar, once every indicator behind them has a value. */
export type Bar = {
  atr: number;
  close: number;
  fastAverage: number;
  high: number;
  low: number;
  obv: number;
  openTimeInISO: string;
  /** Close divided by the benchmark's close, or `null` while no benchmark has been fed. */
  relative: number | null;
  rsi: number;
  volume: number;
};

/** The two halves of the window, which every check that compares "then" with "now" reads. */
function olderAndRecentHalf(bars: readonly Bar[]) {
  const middle = Math.floor(bars.length / 2);
  return {older: bars.slice(0, middle), recent: bars.slice(middle)};
}

/** The periods the card was built with, which name the indicator each reading comes off. */
export type CheckPeriods = {
  fastAverage: number;
  rsi: number;
  trueRange: number;
};

/**
 * Answers every check off a window of bars that already carry their indicator values, which is
 * why it needs no indicator of its own: the same window read twice gives the same card.
 *
 * The periods come in only to name what each reading was taken off, so a card built on a 20-bar
 * average says `SMA 20` rather than claiming the conventional 50.
 */
export function readChecks({
  latest,
  oldest,
  periods,
  window,
}: {
  latest: Bar;
  oldest: Bar;
  periods: CheckPeriods;
  window: readonly Bar[];
}): Record<WeaknessCheckName, Reading> {
  const fast = `SMA ${periods.fastAverage}`;
  /* Where a fall below the fast average stops being a pullback, in that instrument's own ranges. */
  const breakLine = latest.fastAverage - FAST_AVERAGE_BREAK_IN_ATR * latest.atr;
  const momentum = `RSI ${periods.rsi}`;
  const range = `ATR ${periods.trueRange}`;
  const {older, recent} = olderAndRecentHalf(window);
  const indexValues = window.map(bar => bar.rsi);
  const recentHigh = getMaximum(recent.map(bar => bar.high));
  const olderHigh = getMaximum(older.map(bar => bar.high));
  const recentLow = getMinimum(recent.map(bar => bar.low));
  const olderLow = getMinimum(older.map(bar => bar.low));
  const recentIndexPeak = getMaximum(recent.map(bar => bar.rsi));
  const olderIndexPeak = getMaximum(older.map(bar => bar.rsi));
  const recentVolumePeak = getMaximum(recent.map(bar => bar.obv));
  const olderVolumePeak = getMaximum(older.map(bar => bar.obv));

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

  return {
    // Range widening as price falls is what separates a breakdown from a slow drift lower.
    atrExpandingWhileFalling: {
      fired: latest.close < oldest.close && latest.atr > oldest.atr,
      measures: [
        measure('Price', 'close vs window start', latest.close, oldest.close),
        measure(range, 'range vs window start', latest.atr, oldest.atr),
      ],
    },
    /*
     * Price reaching a higher high while the index or the volume line does not: the move is
     * running on less force than the one before it.
     */
    bearishDivergence: {
      fired: recentHigh > olderHigh && (recentIndexPeak < olderIndexPeak || recentVolumePeak < olderVolumePeak),
      measures: [
        measure('Price', 'recent high vs earlier high', recentHigh, olderHigh),
        measure(momentum, 'recent peak vs earlier peak', recentIndexPeak, olderIndexPeak),
        measure('OBV', 'recent peak vs earlier peak', recentVolumePeak, olderVolumePeak),
      ],
    },
    /*
     * Price under the average is the premise, not the finding: on its own it is as often a pullback
     * as a break. Either of two things makes it a finding. The average has turned down, which is
     * the slow confirmation, or price has fallen {@link FAST_AVERAGE_BREAK_IN_ATR} average ranges
     * below it, which says the same thing weeks earlier: a 50-bar average needs weeks of selling
     * before it turns, and a chart does not wait for it.
     */
    brokenBelowFastAverage: {
      fired: latest.close < latest.fastAverage && (latest.fastAverage < oldest.fastAverage || latest.close < breakLine),
      measures: [
        measure(fast, 'close vs average', latest.close, latest.fastAverage),
        measure(fast, 'average vs window start', latest.fastAverage, oldest.fastAverage),
        measure(fast, `close vs ${FAST_AVERAGE_BREAK_IN_ATR} ATR below average`, latest.close, breakLine),
      ],
    },
    /*
     * Heavier trade on down bars than on up bars, by {@link DISTRIBUTION_MARGIN} rather than by any
     * margin at all. A rise in volume on its own says nothing about which side is in a hurry, which
     * is the whole point of separating the two. A window with no bars of one kind has nothing to
     * compare, which a relentless decline produces.
     */
    distribution:
      upVolumes.length === 0 || downVolumes.length === 0
        ? UNREAD
        : {
            fired: getAverage(downVolumes) > getAverage(upVolumes) * (1 + DISTRIBUTION_MARGIN),
            measures: [
              measure(
                'Volume',
                'down bars vs up bars',
                getAverage(downVolumes),
                getAverage(upVolumes) * (1 + DISTRIBUTION_MARGIN)
              ),
            ],
          },
    /*
     * Compared half-window against half-window rather than by pivot detection, so a single
     * outlying bar cannot decide it. Real swing-pivot detection would be stricter about what
     * counts as a high, at the price of needing a pivot definition of its own.
     */
    lowerHighsAndLows: {
      fired: recentHigh < olderHigh && recentLow < olderLow,
      measures: [
        measure('Price', 'recent high vs earlier high', recentHigh, olderHigh),
        measure('Price', 'recent low vs earlier low', recentLow, olderLow),
      ],
    },
    relativeStrength:
      latest.relative === null || oldest.relative === null
        ? UNREAD
        : {
            fired: latest.relative < oldest.relative,
            measures: [measure('Relative', 'ratio vs window start', latest.relative, oldest.relative)],
          },
    rsiBearRange: {
      fired: getMaximum(indexValues) <= BEAR_RANGE_CEILING && getMinimum(indexValues) <= BEAR_RANGE_FLOOR,
      measures: [
        measure(momentum, 'peak vs bear ceiling', getMaximum(indexValues), BEAR_RANGE_CEILING),
        measure(momentum, 'low vs oversold floor', getMinimum(indexValues), BEAR_RANGE_FLOOR),
      ],
    },
    volumeLineFalling: {
      fired: latest.close >= oldest.close && latest.obv < oldest.obv,
      measures: [
        measure('OBV', 'line vs window start', latest.obv, oldest.obv),
        measure('Price', 'close vs window start', latest.close, oldest.close),
      ],
    },
  };
}
