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

/**
 * Answers every check off a window of bars that already carry their indicator values, which is
 * why it needs no indicator of its own: the same window read twice gives the same card.
 *
 * The two average periods come in only to word the measures, so a card read on weekly bars says
 * "50-bar average" about the same number the class fed in.
 */
export function readChecks({
  fastAveragePeriod,
  latest,
  oldest,
  slowAveragePeriod,
  window,
}: {
  fastAveragePeriod: number;
  latest: Bar;
  oldest: Bar;
  slowAveragePeriod: number;
  window: readonly Bar[];
}): Record<WeaknessCheckName, Reading> {
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
        measure('close against the window opening', latest.close, oldest.close),
        measure('average range against the window opening', latest.atr, oldest.atr),
      ],
    },
    /*
     * Price reaching a higher high while the index or the volume line does not: the move is
     * running on less force than the one before it.
     */
    bearishDivergence: {
      fired: recentHigh > olderHigh && (recentIndexPeak < olderIndexPeak || recentVolumePeak < olderVolumePeak),
      measures: [
        measure('latest high against the earlier high', recentHigh, olderHigh),
        measure('momentum peak against the earlier peak', recentIndexPeak, olderIndexPeak),
        measure('volume line peak against the earlier peak', recentVolumePeak, olderVolumePeak),
      ],
    },
    /*
     * Both conditions, because price below a still-rising average is usually a pullback rather
     * than a change of trend.
     */
    belowFallingFastAverage: {
      fired: latest.close < latest.fastAverage && latest.fastAverage < oldest.fastAverage,
      measures: [
        measure(`close against the ${fastAveragePeriod}-bar average`, latest.close, latest.fastAverage),
        measure(`${fastAveragePeriod}-bar average against the window opening`, latest.fastAverage, oldest.fastAverage),
      ],
    },
    deathCross: {
      fired:
        latest.fastAverage < latest.slowAverage ||
        (latest.close < latest.slowAverage && latest.slowAverage < oldest.slowAverage),
      measures: [
        measure(
          `${fastAveragePeriod}-bar average against the ${slowAveragePeriod}-bar average`,
          latest.fastAverage,
          latest.slowAverage
        ),
        measure(`close against the ${slowAveragePeriod}-bar average`, latest.close, latest.slowAverage),
        measure(`${slowAveragePeriod}-bar average against the window opening`, latest.slowAverage, oldest.slowAverage),
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
            measures: [
              measure('volume on down bars against volume on up bars', getAverage(downVolumes), getAverage(upVolumes)),
            ],
          },
    lowerBandRide: {
      fired: latest.close <= latest.lowerBand && latest.bandWidth > oldest.bandWidth,
      measures: [
        measure('close against the lower band', latest.close, latest.lowerBand),
        measure('band width against the window opening', latest.bandWidth, oldest.bandWidth),
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
        measure('latest high against the earlier high', recentHigh, olderHigh),
        measure('latest low against the earlier low', recentLow, olderLow),
      ],
    },
    /*
     * Below the zero line and freshly back below its signal. Below zero alone only restates the
     * trend the first three checks already cover, so the crossing has to be inside the window.
     */
    macdBelowZero: {
      fired: latest.macd < 0 && latest.macd < latest.macdSignal && window.some(bar => bar.macd >= bar.macdSignal),
      measures: [
        measure('MACD against its zero line', latest.macd, 0),
        measure('MACD against its signal line', latest.macd, latest.macdSignal),
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
            measures: [measure('ratio to the benchmark against the window opening', latest.relative, oldest.relative)],
          },
    rsiBearRange: {
      fired: getMaximum(indexValues) <= BEAR_RANGE_CEILING && getMinimum(indexValues) <= BEAR_RANGE_FLOOR,
      measures: [
        measure('momentum peak against the bear range ceiling', getMaximum(indexValues), BEAR_RANGE_CEILING),
        measure('momentum low against the oversold floor', getMinimum(indexValues), BEAR_RANGE_FLOOR),
      ],
    },
    volumeLineFalling: {
      fired: latest.close >= oldest.close && latest.obv < oldest.obv,
      measures: [
        measure('volume line against the window opening', latest.obv, oldest.obv),
        measure('close against the window opening', latest.close, oldest.close),
      ],
    },
  };
}
