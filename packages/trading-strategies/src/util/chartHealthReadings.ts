import {getAverage, getMaximum, getMinimum} from 'trading-signals';
import {
  BEAR_RANGE_CEILING,
  BEAR_RANGE_FLOOR,
  UNREAD,
  measure,
  type Reading,
  type WeaknessCheckName,
} from './chartHealthChecks.js';

/** What the checks need to know about one bar, once every indicator behind them has a value. */
export type Bar = {
  atr: number;
  bandWidth: number;
  close: number;
  fastAverage: number;
  high: number;
  low: number;
  lowerBand: number;
  macd: number;
  macdSignal: number;
  obv: number;
  openTimeInISO: string;
  /** Close divided by the benchmark's close, or `null` while no benchmark has been fed. */
  relative: number | null;
  rsi: number;
  slowAverage: number;
  volume: number;
};

/** The two halves of the window, which every check that compares "then" with "now" reads. */
function olderAndRecentHalf(bars: readonly Bar[]) {
  const middle = Math.floor(bars.length / 2);
  return {older: bars.slice(0, middle), recent: bars.slice(middle)};
}

/** The periods the card was built with, which name the indicator each reading comes off. */
export type CheckPeriods = {
  bollinger: number;
  fastAverage: number;
  rsi: number;
  slowAverage: number;
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
  const slow = `SMA ${periods.slowAverage}`;
  const momentum = `RSI ${periods.rsi}`;
  const range = `ATR ${periods.trueRange}`;
  const bands = `Bollinger ${periods.bollinger}`;
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
     * Both conditions, because price below a still-rising average is usually a pullback rather
     * than a change of trend.
     */
    belowFallingFastAverage: {
      fired: latest.close < latest.fastAverage && latest.fastAverage < oldest.fastAverage,
      measures: [
        measure(fast, 'close vs average', latest.close, latest.fastAverage),
        measure(fast, 'average vs window start', latest.fastAverage, oldest.fastAverage),
      ],
    },
    deathCross: {
      fired:
        latest.fastAverage < latest.slowAverage ||
        (latest.close < latest.slowAverage && latest.slowAverage < oldest.slowAverage),
      measures: [
        measure(`${fast}/${periods.slowAverage}`, 'fast vs slow average', latest.fastAverage, latest.slowAverage),
        measure(slow, 'close vs average', latest.close, latest.slowAverage),
        measure(slow, 'average vs window start', latest.slowAverage, oldest.slowAverage),
      ],
    },
    /*
     * Heavier trade on down bars than on up bars. A rise in volume on its own says nothing about
     * which side is in a hurry, which is the whole point of separating the two. A window with no
     * bars of one kind has nothing to compare, which a relentless decline produces.
     */
    distribution:
      upVolumes.length === 0 || downVolumes.length === 0
        ? UNREAD
        : {
            fired: getAverage(downVolumes) > getAverage(upVolumes),
            measures: [measure('Volume', 'down bars vs up bars', getAverage(downVolumes), getAverage(upVolumes))],
          },
    lowerBandRide: {
      fired: latest.close <= latest.lowerBand && latest.bandWidth > oldest.bandWidth,
      measures: [
        measure(bands, 'close vs lower band', latest.close, latest.lowerBand),
        measure(bands, 'width vs window start', latest.bandWidth, oldest.bandWidth),
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
    /*
     * Below the zero line and freshly back below its signal. Below zero alone only restates the
     * trend the first three checks already cover, so the crossing has to be inside the window.
     */
    macdBelowZero: {
      fired: latest.macd < 0 && latest.macd < latest.macdSignal && window.some(bar => bar.macd >= bar.macdSignal),
      measures: [
        measure('MACD', 'line vs zero', latest.macd, 0),
        measure('MACD', 'line vs signal', latest.macd, latest.macdSignal),
      ],
    },
    /*
     * Ground lost to the benchmark across the window. Measured on the ratio of the two closes
     * rather than on price, so it fires on an instrument that rises less than its index as well
     * as on one that falls harder, which is what makes it an early warning rather than a
     * restatement of the trend checks.
     */
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
