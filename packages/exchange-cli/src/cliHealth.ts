import {ms} from 'ms';
import {z} from 'zod';
import {getCandlesUntil, type Candle, type CandleFeed, type TradingPair} from '@typedtrader/exchange';
import {ChartHealth, type HealthReport, type WeaknessMeasure} from 'trading-strategies';

/**
 * The card is read on daily bars, which is the size every period on it is conventionally counted
 * in: a 50- and 200-day average, a 14-day momentum index, a 14-day range, 20-day bands. Offering a
 * bar size would not read the same card on another clock, it would silently redefine every one of
 * those periods, so the CLI does not offer one.
 */
const TIMEFRAME = '1d';

/**
 * A day a card can be read as of, checked rather than trusted: `2026-02-31` has the right shape and
 * is not a day, and `2026-1-2` is not one either on a feed that stamps bars `YYYY-MM-DD`.
 *
 * Branded, so the checked day is what travels on to the candle request and an unchecked string does
 * not type-check its way there. Everything downstream dates a bar by it.
 */
export const CalendarDaySchema = z.iso.date().brand<'CalendarDay'>();
export type CalendarDay = z.output<typeof CalendarDaySchema>;

export interface HealthRequest {
  /**
   * Day (UTC) the card is read as of, so every period on it counts back from that session instead
   * of from today. A day rather than an instant because the card is daily: asking for the 20th
   * means the session of the 20th, whatever hour its bar is stamped with. Left out, the card reads
   * the newest closed bar.
   */
  asOf?: CalendarDay | undefined;
  /**
   * Index or sector proxy the relative strength check measures the instrument against, such as
   * `SPY` for the broad market or the SPDR sector fund the instrument belongs to, `XLK` for a
   * technology name and `XLE` for an oil one. A proxy only answers the question it is: measured
   * against `SPY`, a chip maker in a falling semiconductor market reads as weak even when it is
   * the strongest name in its sector.
   */
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
  broker: Pick<CandleFeed, 'getCandles' | 'getRecentCandles'>,
  pair: TradingPair,
  {asOf, benchmark, count}: HealthRequest
): Promise<HealthReport> {
  const intervalInMillis = ms(TIMEFRAME);
  // The whole of the requested day, so the bar opening within it is the last one on the card.
  const cutoffInMillis = asOf === undefined ? undefined : Date.parse(`${asOf}T23:59:59.999Z`);
  const history = async (series: TradingPair) => {
    if (cutoffInMillis === undefined) {
      return broker.getRecentCandles(series, count, intervalInMillis);
    }

    const candles = await getCandlesUntil(broker, series, count, intervalInMillis, cutoffInMillis);
    const nowInMillis = Date.now();

    /*
     * A window ending today reaches the session that is still forming, and half a bar answers the
     * checks differently from the whole one. `getRecentCandles` withholds it, so a dated card has
     * to as well, or asking for today would read a different card than asking for no date at all.
     *
     * By the bar's own stated size, which is conservative on a feed that stamps a daily bar at the
     * session open rather than on the grid: at worst the card ends one session earlier than it
     * could, and `asOf` says which bar it read.
     */
    return candles.filter(candle => candle.openTimeInMillis + candle.sizeInMillis <= nowInMillis);
  };

  const candles = await history(pair);
  const benchmarkByOpenTime = new Map<number, Candle>();

  if (benchmark) {
    for (const candle of await history(benchmark)) {
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
      `Scoring ${pair.base}${asOf === undefined ? '' : ` as of ${asOf}`} needs at least ${card.getRequiredBars()} daily candles, but ${candles.length} arrived. Raise --count.`
    );
  }

  return report;
}

/** Thousands separators and a fixed scale, so a volume and a price line up under each other. */
function amount(value: number): string {
  return value.toLocaleString('en-US', {maximumFractionDigits: 2, minimumFractionDigits: 2});
}

/**
 * Column widths, so the header and every row under it line up without pulling in a table library.
 * CHECK and DESCRIPTION are wide enough for the longest of each the card produces, `Bollinger 20`
 * and `recent high vs earlier high`.
 */
const COLUMN = {check: 15, description: 29, divergence: 12, number: 16, verdict: 4} as const;
const QUESTION_WIDTH = COLUMN.verdict + 2 + COLUMN.check + COLUMN.description + COLUMN.number * 2;

function headerRow(): string {
  return (
    'CRIT'.padStart(COLUMN.verdict) +
    '  ' +
    'CHECK'.padEnd(COLUMN.check) +
    'DESCRIPTION'.padEnd(COLUMN.description) +
    'VALUE'.padStart(COLUMN.number) +
    'THRESHOLD'.padStart(COLUMN.number) +
    'DIVERGENCE'.padStart(COLUMN.divergence)
  );
}

function measureRow({deviationPercent, indicator, label, limit, reading}: WeaknessMeasure): string {
  const divergence = deviationPercent === null ? '' : `${deviationPercent > 0 ? '+' : ''}${deviationPercent}%`;

  return (
    ' '.repeat(COLUMN.verdict + 2) +
    indicator.padEnd(COLUMN.check) +
    label.padEnd(COLUMN.description) +
    amount(reading).padStart(COLUMN.number) +
    amount(limit).padStart(COLUMN.number) +
    divergence.padStart(COLUMN.divergence)
  );
}

/**
 * Lays the card out for a reader rather than for a parser: a question per check with its verdict
 * beside it, and under each one the numbers that produced it, so the deductions that add up to the
 * score can be followed down the page.
 *
 * CRIT answers the question: `YES` is the bad answer and costs the points in the right-hand column,
 * `n/a` is a check the window held nothing to read. DIVERGENCE is VALUE measured against THRESHOLD,
 * and is blank where a percentage would be meaningless, as against a zero line.
 */
export function formatHealthReport(ticker: string, report: HealthReport): string {
  const lines = [
    `${ticker}  ${report.health}/100  ${report.verdict}`,
    // The card is daily, so the calendar day is the whole of what its timestamp says.
    `as of ${report.asOf.slice(0, 10)} on ${report.timeframe} bars` +
      (report.unreadWeight === 0 ? '' : `, ${report.unreadWeight} points unread`) +
      (report.soleCategory === null ? '' : `, resting on ${report.soleCategory} alone`),
    '',
    headerRow(),
  ];

  for (const check of report.checks) {
    const verdict = check.fired === null ? 'n/a' : check.fired ? 'YES' : 'no';
    const cost = check.fired === true ? `-${check.weight}` : '';

    lines.push(
      `${verdict.padStart(COLUMN.verdict)}  ${check.question}`.padEnd(QUESTION_WIDTH) + cost.padStart(COLUMN.divergence)
    );
    lines.push(...check.measures.map(measureRow));
  }

  return lines.join('\n');
}
