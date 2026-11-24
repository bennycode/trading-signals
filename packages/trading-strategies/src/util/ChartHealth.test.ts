import type {Candle} from '@typedtrader/exchange';
import {NotEnoughDataError} from 'trading-signals';
import {describe, expect, it} from 'vitest';
import {classifyChartHealth, ChartHealth, type WeaknessCheckName, type ChartHealthOptions} from './ChartHealth.js';

const ONE_DAY_IN_MS = 86_400_000;

type BarShape = {
  /** Candle range, which widens when a decline turns disorderly. */
  range: (index: number) => number;
  volume: (falling: boolean) => number;
};

/**
 * Builds day-aligned candles around a close series, so a test only has to describe the price path
 * it wants. The bars start on a day boundary because a batch that opens part-way through an
 * interval is dropped rather than scored.
 */
function dailyCandles(closes: readonly number[], shape: BarShape): Candle[] {
  return closes.map((close, index) => {
    const previous = closes[index - 1] ?? close;
    const range = shape.range(index);

    return {
      base: 'AAPL',
      close: String(close),
      counter: 'USD',
      high: String(Math.max(close, previous) + range / 2),
      low: String(Math.min(close, previous) - range / 2),
      open: String(previous),
      openTimeInISO: new Date(index * ONE_DAY_IN_MS).toISOString(),
      openTimeInMillis: index * ONE_DAY_IN_MS,
      sizeInMillis: ONE_DAY_IN_MS,
      volume: String(shape.volume(close < previous)),
    };
  });
}

function scoreOf(series: readonly Candle[], options?: ChartHealthOptions, benchmark?: readonly Candle[]) {
  const health = new ChartHealth(options);

  series.forEach((candle, index) => {
    health.add(candle, benchmark?.[index]);
  });

  return health;
}

function firedNames(health: ChartHealth): WeaknessCheckName[] {
  return health
    .getReportOrThrow()
    .checks.filter(check => check.fired === true)
    .map(check => check.name);
}

const STEADY_VOLUME = 1_000_000;
const CALM_BARS: BarShape = {range: () => 1.5, volume: () => STEADY_VOLUME};

const risingCloses = Array.from({length: 280}, (_, index) => 100 + index * 0.8);

/** A long advance, then a hard break with ranges widening and heavy trade on the way down. */
const breakdownCloses = [
  ...Array.from({length: 220}, (_, index) => 100 + index),
  ...Array.from({length: 60}, (_, index) => 320 - (index + 1) * 2.5),
];

const BREAKDOWN_BARS: BarShape = {
  range: index => (index < 220 ? 2 : 2 + (index - 220) * 0.25),
  volume: falling => (falling ? 4_000_000 : 900_000),
};

/** Price going nowhere while the selling arrives on heavier volume than the buying. */
const flatCloses = [
  ...Array.from({length: 240}, (_, index) => 200 + Math.sin(index / 3) * 1.5),
  ...Array.from({length: 40}, (_, index) => 200 + (index % 2 === 0 ? -1 : 1.2)),
];

describe('ChartHealth', () => {
  it('withholds a report until every indicator behind the checks has a value', () => {
    const health = scoreOf(dailyCandles(risingCloses.slice(0, 120), CALM_BARS));

    expect(health.isReady).toBe(false);
    expect(health.getReport(), 'a card with no readings on it makes no claim about the instrument').toBeNull();
    expect(() => health.getReportOrThrow()).toThrow(NotEnoughDataError);
  });

  it('scores a steady advance as noise', () => {
    const report = scoreOf(dailyCandles(risingCloses, CALM_BARS)).getReportOrThrow();

    expect(report.health).toBe(100);
    expect(report.verdict).toBe('noise');
    expect(report.soleCategory).toBeNull();
  });

  it('confirms a downtrend once trend, momentum and volatility agree', () => {
    const health = scoreOf(dailyCandles(breakdownCloses, BREAKDOWN_BARS));
    const report = health.getReportOrThrow();

    expect(firedNames(health)).toStrictEqual([
      'lowerHighsAndLows',
      'belowFallingFastAverage',
      'deathCross',
      'rsiBearRange',
      'atrExpandingWhileFalling',
    ]);
    expect(report.health).toBe(45);
    expect(report.verdict).toBe('downtrend');
    expect(report.soleCategory, 'three kinds of evidence agreed, so nothing here is one-sided').toBeNull();
  });

  it('names the category when weakness shows up in volume alone', () => {
    const health = scoreOf(
      dailyCandles(flatCloses, {range: () => 1.2, volume: falling => (falling ? 5_000_000 : 800_000)})
    );
    const report = health.getReportOrThrow();

    expect(firedNames(health)).toStrictEqual(['distribution', 'volumeLineFalling']);
    expect(report.health).toBe(75);
    expect(report.verdict).toBe('weakening');
    expect(report.soleCategory, 'the chart is flat, so the warning rests entirely on the tape').toBe('volume');
  });

  it('keeps the checks read from the instrument own bars worth 100 points in total', () => {
    const {checks} = scoreOf(dailyCandles(risingCloses, CALM_BARS)).getReportOrThrow();
    const ownBars = checks.filter(check => check.category !== 'relative');

    expect(ownBars.reduce((sum, check) => sum + check.weight, 0)).toBe(100);
    expect(
      checks.reduce((sum, check) => sum + check.weight, 0),
      'relative strength deducts on top of that budget, and health is floored at 0'
    ).toBe(115);
  });

  it('reads the instrument as losing ground to a rising benchmark', () => {
    const flat = dailyCandles(flatCloses, CALM_BARS);
    const rising = dailyCandles(risingCloses, CALM_BARS);
    const falling = dailyCandles([...risingCloses].reverse(), CALM_BARS);

    expect(firedNames(scoreOf(flat, undefined, rising))).toContain('relativeStrength');
    expect(
      firedNames(scoreOf(flat, undefined, falling)),
      'the same flat chart holds its ground against a benchmark that is falling harder'
    ).not.toContain('relativeStrength');
  });

  it('counts an unread check as flattering the score by its own weight', () => {
    const withoutBenchmark = scoreOf(dailyCandles(flatCloses, CALM_BARS)).getReportOrThrow();
    const relativeStrength = withoutBenchmark.checks.find(check => check.name === 'relativeStrength');

    expect(relativeStrength?.fired, 'a check with no benchmark to read is unanswered, not answered "no"').toBeNull();
    expect(withoutBenchmark.unreadWeight).toBe(15);

    const withBenchmark = scoreOf(
      dailyCandles(flatCloses, CALM_BARS),
      undefined,
      dailyCandles(risingCloses, CALM_BARS)
    ).getReportOrThrow();

    expect(withBenchmark.unreadWeight, 'every check has something to read once a benchmark arrives').toBe(0);
  });

  it('leaves distribution unread when the window holds no bars of one kind', () => {
    const report = scoreOf(dailyCandles(breakdownCloses, BREAKDOWN_BARS)).getReportOrThrow();
    const distribution = report.checks.find(check => check.name === 'distribution');

    expect(distribution?.fired, 'a relentless decline has no up bars whose volume could be compared').toBeNull();
  });

  it('lets no single category reach the confirmed band on its own', () => {
    const perCategory = new Map<string, number>();

    for (const check of scoreOf(dailyCandles(risingCloses, CALM_BARS)).getReportOrThrow().checks) {
      perCategory.set(check.category, (perCategory.get(check.category) ?? 0) + check.weight);
    }

    for (const [category, weight] of perCategory) {
      expect(weight, `"${category}" must not be able to confirm a downtrend by itself`).toBeLessThan(50);
    }
  });

  it('reports the bar size the score was read on', () => {
    const report = scoreOf(dailyCandles(risingCloses, CALM_BARS), {timeframe: '1d'}).getReportOrThrow();

    expect(report.timeframe).toBe('1d');
  });

  it('counts an indicator period in bars of that indicator own bar size', () => {
    const series = dailyCandles(risingCloses, CALM_BARS);

    expect(
      scoreOf(series, {slowAveragePeriod: 200, slowAverageTimeframe: '1w'}).isReady,
      '200 weekly bars need far more daily candles than this series holds'
    ).toBe(false);
    expect(scoreOf(series, {slowAveragePeriod: 200}).isReady).toBe(true);
  });

  it('states how many of its own bars it needs before it can judge', () => {
    const daily = new ChartHealth({lookback: 20, slowAveragePeriod: 200});

    expect(daily.getRequiredBars(), 'the slow average warm-up plus a full window').toBe(219);

    const weeklyTrend = new ChartHealth({lookback: 20, slowAveragePeriod: 200, slowAverageTimeframe: '1w'});

    expect(weeklyTrend.getRequiredBars(), '200 weekly bars measured in daily bars, plus the window').toBe(1419);
  });

  it('holds a slower indicator at its last close between its own bars', () => {
    const series = dailyCandles(breakdownCloses, BREAKDOWN_BARS);
    const weeklyMomentum = scoreOf(series, {rsiTimeframe: '1w'}).getReportOrThrow();
    const dailyMomentum = scoreOf(series).getReportOrThrow();

    expect(
      weeklyMomentum.health,
      'a weekly momentum reading does not sit in its bear range at the same moment a daily one does'
    ).not.toBe(dailyMomentum.health);
  });

  it('starts judging sooner with a shorter lookback', () => {
    const series = dailyCandles(risingCloses.slice(0, 210), CALM_BARS);

    expect(scoreOf(series, {lookback: 5}).isReady).toBe(true);
    expect(scoreOf(series).isReady, 'the default window still needs more bars than this series holds').toBe(false);
  });
});

describe('classifyChartHealth', () => {
  it('reads each band from its lowest score to its highest', () => {
    expect(classifyChartHealth(100)).toBe('noise');
    expect(classifyChartHealth(76)).toBe('noise');
    expect(classifyChartHealth(75)).toBe('weakening');
    expect(classifyChartHealth(51)).toBe('weakening');
    expect(classifyChartHealth(50)).toBe('downtrend');
    expect(classifyChartHealth(26)).toBe('downtrend');
    expect(classifyChartHealth(25)).toBe('distribution');
    expect(classifyChartHealth(0)).toBe('distribution');
  });
});
