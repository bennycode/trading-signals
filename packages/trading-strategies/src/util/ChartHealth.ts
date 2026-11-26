import {ms, type StringValue} from 'ms';
import {CandleBatcher, type BatchedCandle, type Candle} from '@typedtrader/exchange';
import {
  ATR,
  BollingerBands,
  EMA,
  getAverage,
  getMaximum,
  getMinimum,
  MACD,
  NotEnoughDataError,
  OBV,
  pushUpdate,
  RSI,
  SMA,
} from 'trading-signals';

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
  /** What the two numbers are, in the card's own terms rather than in indicator names. */
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
const FULL_HEALTH = 100;

/**
 * Points each check deducts from full health. A check weighs more when it is hard to argue with on
 * its own terms: price making lower highs and lower lows needs no parameter and no threshold, while
 * a single tag of a Bollinger band is as often a bounce as a breakdown.
 *
 * The ten checks read from the instrument's own bars are a closed budget of 100. Relative strength
 * deducts on top of that budget rather than inside it, and health is floored at 0: a card given a
 * benchmark must not read a breakdown as healthier than the same card without one.
 */
const WEIGHTS = [
  {category: 'relative', name: 'relativeStrength', weight: 15},
  {category: 'trend', name: 'lowerHighsAndLows', weight: 18},
  {category: 'trend', name: 'belowFallingFastAverage', weight: 12},
  {category: 'trend', name: 'deathCross', weight: 10},
  {category: 'momentum', name: 'rsiBearRange', weight: 9},
  {category: 'momentum', name: 'macdBelowZero', weight: 8},
  {category: 'momentum', name: 'bearishDivergence', weight: 8},
  {category: 'volume', name: 'distribution', weight: 13},
  {category: 'volume', name: 'volumeLineFalling', weight: 12},
  {category: 'volatility', name: 'atrExpandingWhileFalling', weight: 6},
  {category: 'volatility', name: 'lowerBandRide', weight: 4},
] as const satisfies readonly {category: WeaknessCategory; name: WeaknessCheckName; weight: number}[];

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
const BEAR_RANGE_CEILING = 60;
const BEAR_RANGE_FLOOR = 30;

export function classifyChartHealth(health: number): WeaknessVerdict {
  const band = BANDS.find(candidate => health >= candidate.minHealth);
  return band ? band.verdict : 'distribution';
}

export type ChartHealthOptions = {
  bollingerDeviation?: number;
  bollingerPeriod?: number;
  /** Bar size the Bollinger bands are measured on. Defaults to {@link ChartHealthOptions.timeframe}. */
  bollingerTimeframe?: StringValue;
  fastAveragePeriod?: number;
  /** Bar size the fast average is measured on. Defaults to {@link ChartHealthOptions.timeframe}. */
  fastAverageTimeframe?: StringValue;
  /**
   * How many of the most recent bars the checks read, counted in bars of
   * {@link ChartHealthOptions.timeframe}. It also sets the distance over which a moving average
   * counts as falling and a range as expanding, so a shorter window makes the whole card quicker
   * to fire and quicker to change its mind.
   */
  lookback?: number;
  /** Bar size the MACD is measured on. Defaults to {@link ChartHealthOptions.timeframe}. */
  macdTimeframe?: StringValue;
  /** Bar size the volume line is measured on. Defaults to {@link ChartHealthOptions.timeframe}. */
  obvTimeframe?: StringValue;
  rsiPeriod?: number;
  /** Bar size the momentum index is measured on. Defaults to {@link ChartHealthOptions.timeframe}. */
  rsiTimeframe?: StringValue;
  slowAveragePeriod?: number;
  /** Bar size the slow average is measured on. Defaults to {@link ChartHealthOptions.timeframe}. */
  slowAverageTimeframe?: StringValue;
  /**
   * Bar size of the card itself: the clock the window advances on, and the default bar size for
   * every indicator that does not name its own.
   */
  timeframe?: StringValue;
  trueRangePeriod?: number;
  /** Bar size the average range is measured on. Defaults to {@link ChartHealthOptions.timeframe}. */
  trueRangeTimeframe?: StringValue;
};

/** What the checks need to know about one bar, once every indicator behind them has a value. */
type Bar = {
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

/** One indicator with the bar size it reads, and the batcher that cuts the feed to that size. */
type Part = {
  batcher: CandleBatcher;
  feed: (bar: BatchedCandle) => void;
  intervalInMillis: number;
  requiredInputs: number;
};

/** A check's verdict together with the comparisons it reached that verdict on. */
type Reading = {fired: boolean | null; measures: WeaknessMeasure[]};

/** A check the window held nothing to read: it compared nothing, so it shows no numbers. */
const UNREAD: Reading = {fired: null, measures: []};

function measure(label: string, reading: number, limit: number): WeaknessMeasure {
  const deviation = limit === 0 ? null : ((reading - limit) / Math.abs(limit)) * 100;

  return {
    deviationPercent: deviation === null ? null : Math.round(deviation * 100) / 100,
    label,
    limit,
    reading,
  };
}

function olderAndRecentHalf(bars: readonly Bar[]) {
  const middle = Math.floor(bars.length / 2);
  return {older: bars.slice(0, middle), recent: bars.slice(middle)};
}

/**
 * Scores the chart health of a single instrument from 100 down to 0, by reading eleven checks
 * across trend, momentum, volume, volatility and relative strength and deducting from full health
 * according to what each check is worth on its own. It reads like a credit score: 100 is an
 * instrument with nothing against it, 0 is one with the whole set against it.
 *
 * It exists because no single reading answers the question a holder actually has: whether this is
 * a pullback inside an intact trend or a breakdown. Any one check fires often enough in a healthy
 * market to be useless alone, so the total only earns its reading when several kinds of evidence
 * agree — see {@link HealthReport.soleCategory} for the case where they do not.
 *
 * Every indicator reads its own bar size, so a weekly slow average can be scored against a daily
 * window. Feed candles of any one size and they are batched up to each indicator's bar size;
 * between its own bars an indicator holds the value it last closed at, which is what reading a
 * weekly average on a daily chart means. Periods stay counts of bars at the indicator's own bar
 * size: a 200-period slow average on weekly bars is 200 weeks, not 200 days.
 *
 * Relative strength needs a second price series, so it is only read when {@link ChartHealth.add}
 * is given a benchmark candle for the same bar. Without one that check stays unread and the score
 * is optimistic by its weight, which {@link HealthReport.unreadWeight} states.
 *
 * Earnings misses, guidance cuts, insider selling, dividend cuts and short interest are not in the
 * bars at all; treat any of them as a reason to read the verdict one band worse.
 */
export class ChartHealth {
  readonly #atr: ATR;
  readonly #bands: BollingerBands;
  readonly #benchmarkBatcher: CandleBatcher;
  /** Close of the last whole benchmark bar, which the instrument's close is measured against. */
  #benchmarkClose: number | null = null;
  readonly #fastAverage: SMA;
  readonly #lookback: number;
  readonly #macd: MACD;
  readonly #obv: OBV;
  readonly #parts: readonly Part[];
  readonly #rsi: RSI;
  readonly #slowAverage: SMA;
  readonly #timeframe: StringValue;
  readonly #window: Bar[] = [];
  readonly #windowBatcher: CandleBatcher;
  readonly #windowIntervalInMillis: number;

  constructor(options: ChartHealthOptions = {}) {
    const {
      bollingerDeviation = 2,
      bollingerPeriod = 20,
      fastAveragePeriod = 50,
      lookback = 20,
      rsiPeriod = 14,
      slowAveragePeriod = 200,
      timeframe = '1d',
      trueRangePeriod = 14,
    } = options;

    this.#atr = new ATR(trueRangePeriod);
    this.#bands = new BollingerBands(bollingerPeriod, bollingerDeviation);
    this.#fastAverage = new SMA(fastAveragePeriod);
    this.#lookback = lookback;
    // The 12/26/9 periods are the convention the zero line and the signal cross are read against.
    this.#macd = new MACD(new EMA(12), new EMA(26), new EMA(9));
    // Two bars is enough to accumulate the running volume total from the first bar onwards.
    this.#obv = new OBV(2);
    this.#rsi = new RSI(rsiPeriod);
    this.#slowAverage = new SMA(slowAveragePeriod);
    this.#timeframe = timeframe;
    this.#windowIntervalInMillis = ms(timeframe);
    this.#windowBatcher = new CandleBatcher(this.#windowIntervalInMillis);
    this.#benchmarkBatcher = new CandleBatcher(this.#windowIntervalInMillis);

    this.#parts = [
      part(options.trueRangeTimeframe ?? timeframe, this.#atr, bar =>
        this.#atr.add({close: bar.close.toNumber(), high: bar.high.toNumber(), low: bar.low.toNumber()})
      ),
      part(options.bollingerTimeframe ?? timeframe, this.#bands, bar => this.#bands.add(bar.close.toNumber())),
      part(options.fastAverageTimeframe ?? timeframe, this.#fastAverage, bar =>
        this.#fastAverage.add(bar.close.toNumber())
      ),
      part(options.macdTimeframe ?? timeframe, this.#macd, bar => this.#macd.add(bar.close.toNumber())),
      part(options.obvTimeframe ?? timeframe, this.#obv, bar =>
        this.#obv.add({
          close: bar.close.toNumber(),
          high: bar.high.toNumber(),
          low: bar.low.toNumber(),
          open: bar.open.toNumber(),
          volume: bar.volume.toNumber(),
        })
      ),
      part(options.rsiTimeframe ?? timeframe, this.#rsi, bar => this.#rsi.add(bar.close.toNumber())),
      part(options.slowAverageTimeframe ?? timeframe, this.#slowAverage, bar =>
        this.#slowAverage.add(bar.close.toNumber())
      ),
    ];
  }

  /**
   * Feeds one candle of any bar size, newest last. A batch that would start part-way through an
   * indicator's bar is dropped rather than scored, so the first result arrives on the first whole
   * bar of that size.
   *
   * Passing the matching candle of an index or sector proxy as `benchmark` turns on the relative
   * strength check. Both arrive in the same call so the two series cannot drift apart; leave it out
   * on every call or pass it on every call, since a benchmark seen once is held until it is
   * replaced.
   */
  add(candle: BatchedCandle | Candle, benchmark?: BatchedCandle | Candle): void {
    if (benchmark) {
      const benchmarkBar = this.#benchmarkBatcher.addToBatch(benchmark);

      if (benchmarkBar) {
        this.#benchmarkClose = benchmarkBar.close.toNumber();
      }
    }

    for (const {batcher, feed} of this.#parts) {
      const bar = batcher.addToBatch(candle);

      if (bar) {
        feed(bar);
      }
    }

    const windowBar = this.#windowBatcher.addToBatch(candle);

    if (windowBar) {
      this.#takeSnapshot(windowBar);
    }
  }

  get isReady() {
    return this.#window.length === this.#lookback;
  }

  /**
   * Bars of the card's own size needed before a report exists. An indicator on a slower bar size
   * raises this, because its own warm-up has to fit inside that many of the card's bars.
   */
  getRequiredBars() {
    const perPart = this.#parts.map(
      ({intervalInMillis, requiredInputs}) => (requiredInputs * intervalInMillis) / this.#windowIntervalInMillis
    );

    return Math.ceil(Math.max(...perPart)) + this.#lookback - 1;
  }

  getReport(): HealthReport | null {
    const latest = this.#window.at(-1);
    const oldest = this.#window.at(0);

    if (!this.isReady || !latest || !oldest) {
      return null;
    }

    const readings = this.#evaluate({latest, oldest});
    const checks = WEIGHTS.map(entry => ({
      category: entry.category,
      fired: readings[entry.name].fired,
      measures: readings[entry.name].measures,
      name: entry.name,
      weight: entry.weight,
    }));
    const deducted = checks.reduce((sum, check) => (check.fired === true ? sum + check.weight : sum), 0);
    const health = Math.max(0, FULL_HEALTH - deducted);

    return {
      asOf: latest.openTimeInISO,
      checks,
      health,
      soleCategory: soleCategory(checks),
      timeframe: this.#timeframe,
      unreadWeight: checks.reduce((sum, check) => (check.fired === null ? sum + check.weight : sum), 0),
      verdict: classifyChartHealth(health),
    };
  }

  getReportOrThrow(): HealthReport {
    const report = this.getReport();

    if (report === null) {
      throw new NotEnoughDataError(this.getRequiredBars());
    }

    return report;
  }

  /**
   * Records the state of every indicator as of this bar. An indicator on a slower bar size has
   * not moved since its own last close, which is the value a trader reading it off a slower chart
   * would see, so its latest result is recorded again rather than skipped.
   */
  #takeSnapshot(bar: BatchedCandle): void {
    const atr = this.#atr.getResult();
    const bands = this.#bands.getResult();
    const fastAverage = this.#fastAverage.getResult();
    const macd = this.#macd.getResult();
    const obv = this.#obv.getResult();
    const rsi = this.#rsi.getResult();
    const slowAverage = this.#slowAverage.getResult();

    if (
      atr === null ||
      bands === null ||
      fastAverage === null ||
      macd === null ||
      obv === null ||
      rsi === null ||
      slowAverage === null
    ) {
      return;
    }

    pushUpdate({
      array: this.#window,
      item: {
        atr,
        bandWidth: bands.upper - bands.lower,
        close: bar.close.toNumber(),
        fastAverage,
        high: bar.high.toNumber(),
        low: bar.low.toNumber(),
        lowerBand: bands.lower,
        macd: macd.macd,
        macdSignal: macd.signal,
        obv,
        openTimeInISO: bar.openTimeInISO,
        relative: this.#benchmarkClose === null ? null : bar.close.toNumber() / this.#benchmarkClose,
        rsi,
        slowAverage,
        volume: bar.volume.toNumber(),
      },
      maxLength: this.#lookback,
      replace: false,
    });
  }

  #evaluate({latest, oldest}: {latest: Bar; oldest: Bar}): Record<WeaknessCheckName, Reading> {
    const {older, recent} = olderAndRecentHalf(this.#window);
    const indexValues = this.#window.map(bar => bar.rsi);
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

    this.#window.forEach((bar, index) => {
      const previous = this.#window[index - 1];

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
          measure('close against the fast average', latest.close, latest.fastAverage),
          measure('fast average against the window opening', latest.fastAverage, oldest.fastAverage),
        ],
      },
      deathCross: {
        fired:
          latest.fastAverage < latest.slowAverage ||
          (latest.close < latest.slowAverage && latest.slowAverage < oldest.slowAverage),
        measures: [
          measure('fast average against the slow average', latest.fastAverage, latest.slowAverage),
          measure('close against the slow average', latest.close, latest.slowAverage),
          measure('slow average against the window opening', latest.slowAverage, oldest.slowAverage),
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
                measure(
                  'volume on down bars against volume on up bars',
                  getAverage(downVolumes),
                  getAverage(upVolumes)
                ),
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
        fired:
          latest.macd < 0 && latest.macd < latest.macdSignal && this.#window.some(bar => bar.macd >= bar.macdSignal),
        measures: [
          measure('trend oscillator against its zero line', latest.macd, 0),
          measure('trend oscillator against its signal', latest.macd, latest.macdSignal),
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
              measures: [
                measure('ratio to the benchmark against the window opening', latest.relative, oldest.relative),
              ],
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
}

function part(
  timeframe: StringValue,
  indicator: {getRequiredInputs: () => number},
  feed: (bar: BatchedCandle) => void
): Part {
  const intervalInMillis = ms(timeframe);

  return {
    batcher: new CandleBatcher(intervalInMillis),
    feed,
    intervalInMillis,
    requiredInputs: indicator.getRequiredInputs(),
  };
}

function soleCategory(checks: readonly WeaknessCheck[]) {
  const categories = new Set(checks.filter(check => check.fired === true).map(check => check.category));
  const [only] = categories;

  return categories.size === 1 && only ? only : null;
}
