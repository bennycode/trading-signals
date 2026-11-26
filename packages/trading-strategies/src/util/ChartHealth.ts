import {ms, type StringValue} from 'ms';
import {CandleBatcher, type BatchedCandle, type Candle} from '@typedtrader/exchange';
import {ATR, BollingerBands, EMA, MACD, NotEnoughDataError, OBV, pushUpdate, RSI, SMA} from 'trading-signals';
import {CHECKS, FULL_HEALTH, classifyChartHealth, soleCategory, type HealthReport} from './chartHealthChecks.js';
import {readChecks, type Bar, type CheckPeriods} from './chartHealthReadings.js';

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

/** One indicator with the bar size it reads, and the batcher that cuts the feed to that size. */
type Part = {
  batcher: CandleBatcher;
  feed: (bar: BatchedCandle) => void;
  intervalInMillis: number;
  requiredInputs: number;
};

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
  readonly #periods: CheckPeriods;
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
    this.#periods = {
      bollinger: bollingerPeriod,
      fastAverage: fastAveragePeriod,
      rsi: rsiPeriod,
      slowAverage: slowAveragePeriod,
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

    const readings = readChecks({latest, oldest, periods: this.#periods, window: this.#window});
    const checks = CHECKS.map(entry => ({
      category: entry.category,
      fired: readings[entry.name].fired,
      measures: readings[entry.name].measures,
      name: entry.name,
      question: entry.question,
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
