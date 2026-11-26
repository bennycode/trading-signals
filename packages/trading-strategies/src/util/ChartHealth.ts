import {ms, type StringValue} from 'ms';
import {CandleBatcher, type BatchedCandle, type Candle} from '@typedtrader/exchange';
import {ATR, NotEnoughDataError, OBV, getPercentageChange, pushUpdate, RSI, SMA} from 'trading-signals';
import {CHECKS, FULL_HEALTH, classifyChartHealth, soleCategory, type HealthReport} from './chartHealthChecks.js';
import {readChecks, type Bar, type CheckPeriods} from './chartHealthReadings.js';
import {
  classifyOpportunity,
  OPPORTUNITY_FIELDS,
  readOpportunity,
  scoreOpportunity,
  type OpportunityCard,
} from './chartOpportunity.js';

export type ChartHealthOptions = {
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
  /** Bar size the volume line is measured on. Defaults to {@link ChartHealthOptions.timeframe}. */
  obvTimeframe?: StringValue;
  rsiPeriod?: number;
  /** Bar size the momentum index is measured on. Defaults to {@link ChartHealthOptions.timeframe}. */
  rsiTimeframe?: StringValue;
  /**
   * Bar size of the card itself: the clock the window advances on, and the default bar size for
   * every indicator that does not name its own.
   */
  timeframe?: StringValue;
  trueRangePeriod?: number;
  /** Bar size the average range is measured on. Defaults to {@link ChartHealthOptions.timeframe}. */
  trueRangeTimeframe?: StringValue;
};

/** One indicator with the bar size it reads, and the batcher that cuts the feed to that size. */
type Part = {
  batcher: CandleBatcher;
  feed: (bar: BatchedCandle) => void;
  intervalInMillis: number;
  requiredInputs: number;
};

/**
 * Scores the chart health of a single instrument from 100 down to 0, by reading eight checks
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
 * is optimistic by its weight, which {@link unreadWeight} totals from the card.
 *
 * Earnings misses, guidance cuts, insider selling, dividend cuts and short interest are not in the
 * bars at all; treat any of them as a reason to read the verdict one band worse.
 */
export class ChartHealth {
  readonly #atr: ATR;
  readonly #benchmarkBatcher: CandleBatcher;
  /** Close of the last whole benchmark bar, which the instrument's close is measured against. */
  #benchmarkClose: number | null = null;
  readonly #fastAverage: SMA;
  readonly #lookback: number;
  readonly #obv: OBV;
  readonly #parts: readonly Part[];
  readonly #rsi: RSI;
  readonly #periods: CheckPeriods;
  readonly #timeframe: StringValue;
  readonly #window: Bar[] = [];
  readonly #windowBatcher: CandleBatcher;
  readonly #windowIntervalInMillis: number;

  constructor(options: ChartHealthOptions = {}) {
    const {fastAveragePeriod = 50, lookback = 20, rsiPeriod = 14, timeframe = '1d', trueRangePeriod = 14} = options;

    this.#atr = new ATR(trueRangePeriod);
    this.#fastAverage = new SMA(fastAveragePeriod);
    this.#lookback = lookback;
    // Two bars is enough to accumulate the running volume total from the first bar onwards.
    this.#obv = new OBV(2);
    this.#rsi = new RSI(rsiPeriod);
    this.#periods = {
      fastAverage: fastAveragePeriod,
      rsi: rsiPeriod,
      trueRange: trueRangePeriod,
    };
    this.#timeframe = timeframe;
    this.#windowIntervalInMillis = ms(timeframe);
    this.#windowBatcher = new CandleBatcher(this.#windowIntervalInMillis);
    this.#benchmarkBatcher = new CandleBatcher(this.#windowIntervalInMillis);

    this.#parts = [
      part(options.trueRangeTimeframe ?? timeframe, this.#atr, bar =>
        this.#atr.add({close: bar.close.toNumber(), high: bar.high.toNumber(), low: bar.low.toNumber()})
      ),
      part(options.fastAverageTimeframe ?? timeframe, this.#fastAverage, bar =>
        this.#fastAverage.add(bar.close.toNumber())
      ),
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

    const readings = readChecks({latest, oldest, periods: this.#periods, window: this.#window});
    const criteria = CHECKS.map(entry => ({
      category: entry.category,
      fired: readings[entry.name].fired,
      measures: readings[entry.name].measures,
      name: entry.name,
      question: entry.question,
      weight: entry.weight,
    }));
    const deducted = criteria.reduce((sum, check) => (check.fired === true ? sum + check.weight : sum), 0);
    const health = Math.max(0, FULL_HEALTH - deducted);

    return {
      asOf: latest.openTimeInISO,
      criteria,
      firedMeans: 'weakness',
      score: {kind: 'ratio', outOf: FULL_HEALTH, value: health},
      soleCategory: soleCategory(criteria),
      timeframe: this.#timeframe,
      verdict: classifyChartHealth(health),
    };
  }

  /**
   * The opportunity card, read off the same window as the health card so the two cannot disagree
   * about what the instrument did. It asks whether a fall belongs to the market rather than to the
   * instrument, which the health card cannot answer because every answer it has is a deduction.
   */
  getOpportunityCard(): OpportunityCard | null {
    const latest = this.#window.at(-1);
    const oldest = this.#window.at(0);

    if (!this.isReady || !latest || !oldest) {
      return null;
    }

    const readings = readOpportunity({latest, oldest, periods: this.#periods, window: this.#window});
    const criteria = OPPORTUNITY_FIELDS.map(field => ({
      category: field.category,
      fired: readings[field.name].fired,
      measures: readings[field.name].measures,
      name: field.name,
      question: field.question,
      weight: field.weight,
    }));
    const score = scoreOpportunity(criteria);
    const returnPercent = getPercentageChange(oldest.close, latest.close);

    return {
      asOf: latest.openTimeInISO,
      criteria,
      firedMeans: 'strength',
      returnPercent,
      score,
      verdict: classifyOpportunity(score.value, returnPercent <= 0),
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
    const fastAverage = this.#fastAverage.getResult();
    const obv = this.#obv.getResult();
    const rsi = this.#rsi.getResult();

    if (atr === null || fastAverage === null || obv === null || rsi === null) {
      return;
    }

    pushUpdate({
      array: this.#window,
      item: {
        atr,
        close: bar.close.toNumber(),
        fastAverage,
        high: bar.high.toNumber(),
        low: bar.low.toNumber(),
        obv,
        openTimeInISO: bar.openTimeInISO,
        relative: this.#benchmarkClose === null ? null : bar.close.toNumber() / this.#benchmarkClose,
        rsi,
        volume: bar.volume.toNumber(),
      },
      maxLength: this.#lookback,
      replace: false,
    });
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
