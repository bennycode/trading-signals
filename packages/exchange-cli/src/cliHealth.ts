import {parse as parseDuration} from 'ms';
import type {Candle, MarketDataSource, TradingPair} from '@typedtrader/exchange';
import {ChartHealth, type HealthReport} from 'trading-strategies';

/**
 * The card is read on daily bars, which is the size every period on it is conventionally counted
 * in: a 50- and 200-day average, a 14-day momentum index, a 14-day range, 20-day bands. Offering a
 * bar size would not read the same card on another clock, it would silently redefine every one of
 * those periods, so the CLI does not offer one.
 */
const TIMEFRAME = '1d';

export interface HealthRequest {
  /** Index or sector proxy the relative strength check measures the instrument against. */
  benchmark?: TradingPair | undefined;
  count: number;
}

/**
 * Reads {@link ChartHealth} off a broker's candle history.
 *
 * The benchmark series is matched to the instrument by candle open time rather than by position,
 * because a halt or a late open leaves one of the two feeds a bar short and scoring a stock against
 * the wrong day of its index would be worse than not scoring it at all.
 */
export async function scoreChartHealth(
  broker: Pick<MarketDataSource, 'getRecentCandles'>,
  pair: TradingPair,
  {benchmark, count}: HealthRequest
): Promise<HealthReport> {
  const intervalInMillis = parseDuration(TIMEFRAME);
  const candles = await broker.getRecentCandles(pair, count, intervalInMillis);
  const benchmarkByOpenTime = new Map<number, Candle>();

  if (benchmark) {
    for (const candle of await broker.getRecentCandles(benchmark, count, intervalInMillis)) {
      benchmarkByOpenTime.set(candle.openTimeInMillis, candle);
    }
  }

  const card = new ChartHealth({timeframe: TIMEFRAME});

  for (const candle of candles) {
    card.add(candle, benchmarkByOpenTime.get(candle.openTimeInMillis));
  }

  const report = card.getReport();

  if (!report) {
    throw new Error(
      `Scoring ${pair.base} needs at least ${card.getRequiredBars()} daily candles, but ${candles.length} arrived. Raise --count.`
    );
  }

  return report;
}

/** Thousands separators and a fixed scale, so a volume and a price line up under each other. */
function amount(value: number): string {
  return value.toLocaleString('en-US', {maximumFractionDigits: 2, minimumFractionDigits: 2});
}

/**
 * Lays the card out for a reader rather than for a parser: the questions in a column, a verdict
 * beside each, and the numbers that produced it underneath. Only what fired carries its cost, so
 * the deductions that add up to the score can be followed down the page.
 */
export function formatHealthReport(ticker: string, report: HealthReport): string {
  const lines = [
    `${ticker}  ${report.health}/100  ${report.verdict}`,
    // The card is daily, so the calendar day is the whole of what its timestamp says.
    `as of ${report.asOf.slice(0, 10)} on ${report.timeframe} bars` +
      (report.unreadWeight === 0 ? '' : `, ${report.unreadWeight} points unread`) +
      (report.soleCategory === null ? '' : `, resting on ${report.soleCategory} alone`),
    '',
  ];

  for (const check of report.checks) {
    const verdict = check.fired === null ? 'n/a' : check.fired ? 'YES' : 'no';
    const cost = check.fired === true ? `-${check.weight}` : '';
    lines.push(`${verdict.padStart(3)}  ${check.question.padEnd(58)} ${cost}`);

    for (const {deviationPercent, label, limit, reading} of check.measures) {
      const gap = deviationPercent === null ? '' : `${deviationPercent > 0 ? '+' : ''}${deviationPercent}%`;
      lines.push(
        `     ${label.padEnd(50)} ${amount(reading).padStart(14)} vs ${amount(limit).padStart(14)} ${gap.padStart(9)}`
      );
    }
  }

  return lines.join('\n');
}
