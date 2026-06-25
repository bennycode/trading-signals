import {z} from 'zod';
import type {AlpacaAPI} from '@typedtrader/exchange';
import {MESSAGE_BREAK, Report} from '../report/Report.js';
import {fetchUsEquityNames, formatSymbolWithName, TELEGRAM_TABLE_NAME_MAX} from '../util/formatSymbolWithName.js';
import {getDateString} from '../util/TimeUtil.js';
import {SP500_TICKERS, SP500_TIMEZONE} from '../util/sp500Tickers.js';

export const SP500MomentumSchema = z.object({});

export type SP500MomentumConfig = z.infer<typeof SP500MomentumSchema>;

interface MomentumResult {
  ticker: string;
  priceNow: number;
  price12MonthsAgo: number;
  returnPct: number;
}

const BATCH_SIZE = 1000;

const WEEKEND_SHIFT_TO_MONDAY: Record<number, number> = {
  0: 1, // Sunday → Monday
  6: 2, // Saturday → Monday
};

/**
 * Anchored in UTC on purpose: the result must not drift with the server's local
 * timezone. Skips weekends only — market holidays are absorbed by the multi-day
 * price-fetch window, which takes the first available bar at or after this date.
 */
function firstTradingDayOfMonth(year: number, monthIndex: number): Date {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  date.setUTCDate(date.getUTCDate() + (WEEKEND_SHIFT_TO_MONDAY[date.getUTCDay()] ?? 0));
  return date;
}

/**
 * Reads which calendar month an instant falls in *at the exchange*, not on the server.
 * Late on the 31st in New York is already the 1st in UTC, so a server-local read would
 * roll the report a day early; resolving in {@link SP500_TIMEZONE} keeps it on the US
 * market calendar.
 */
export function getExchangeYearMonth(isoTimestamp: string, timeZone: string): {month: number; year: number} {
  const fields = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {month: '2-digit', timeZone, year: 'numeric'})
      .formatToParts(new Date(isoTimestamp))
      .map(part => [part.type, part.value])
  );
  return {month: Number(fields.month), year: Number(fields.year)};
}

/**
 * The 12-1 window of Jegadeesh & Titman (1993): drop the most recent (current) month to
 * sidestep short-term reversal, end the formation window at the start of the prior month,
 * and begin it twelve months earlier.
 */
export function getMomentumWindow(exchangeYear: number, exchangeMonth: number): {pastDate: Date; recentDate: Date} {
  const recentDate = firstTradingDayOfMonth(exchangeYear, exchangeMonth - 2);
  const pastDate = firstTradingDayOfMonth(recentDate.getUTCFullYear() - 1, recentDate.getUTCMonth());
  return {pastDate, recentDate};
}

interface RankedMomentum extends MomentumResult {
  /** 1-based position in the current full ranking. */
  rank: number;
  /**
   * Movement versus last month's ranking: positive means the stock climbed toward #1, negative
   * means it slipped. `null` when it wasn't ranked last month (no comparable price), shown as "new".
   */
  rankDelta: number | null;
}

/** Ranks every ticker with a usable price pair by its window return, best first. */
function rankByMomentum(endPrices: Map<string, number>, startPrices: Map<string, number>): MomentumResult[] {
  const results: MomentumResult[] = [];
  for (const ticker of SP500_TICKERS) {
    const priceNow = endPrices.get(ticker);
    const priceThen = startPrices.get(ticker);
    if (priceNow != null && priceThen != null && priceThen > 0) {
      results.push({
        price12MonthsAgo: priceThen,
        priceNow,
        returnPct: ((priceNow - priceThen) / priceThen) * 100,
        ticker,
      });
    }
  }
  results.sort((a, b) => b.returnPct - a.returnPct);
  return results;
}

/** Annotates the current ranking with each ticker's rank movement against the previous month's ranking. */
export function withRankDeltas(current: MomentumResult[], previous: MomentumResult[]): RankedMomentum[] {
  const previousRank = new Map<string, number>();
  previous.forEach((result, index) => previousRank.set(result.ticker, index + 1));
  return current.map((result, index) => {
    const rank = index + 1;
    const priorRank = previousRank.get(result.ticker);
    return {...result, rank, rankDelta: priorRank === undefined ? null : priorRank - rank};
  });
}

/** A marker for the rank column: `▲` climbed, `▼` slipped, `★` new entry (unranked last month), empty when held. */
export function rankDeltaIcon(rankDelta: number | null) {
  if (rankDelta === null) {
    return '★';
  }
  if (rankDelta === 0) {
    return '';
  }
  return rankDelta > 0 ? '▲' : '▼';
}

export class SP500MomentumReport extends Report<SP500MomentumConfig> {
  static override NAME = '@typedtrader/report-sp500-momentum';

  readonly #api: AlpacaAPI;

  constructor(config: SP500MomentumConfig, api: AlpacaAPI) {
    super(config);
    this.#api = api;
  }

  async run() {
    const clock = await this.#api.getClock();
    const {month, year} = getExchangeYearMonth(clock.timestamp, SP500_TIMEZONE);

    // The current ranking and the one a month earlier, so the report can show how ranks moved.
    const current = getMomentumWindow(year, month);
    const previous = getMomentumWindow(year, month - 1);

    const toDate = getDateString(current.recentDate);
    const fromDate = getDateString(current.pastDate);

    const [currentEnd, currentStart, previousEnd, previousStart, names] = await Promise.all([
      this.#getClosingPrices(SP500_TICKERS, current.recentDate),
      this.#getClosingPrices(SP500_TICKERS, current.pastDate),
      this.#getClosingPrices(SP500_TICKERS, previous.recentDate),
      this.#getClosingPrices(SP500_TICKERS, previous.pastDate),
      fetchUsEquityNames(this.#api),
    ]);

    const ranked = withRankDeltas(rankByMomentum(currentEnd, currentStart), rankByMomentum(previousEnd, previousStart));

    return this.#formatResults(ranked, fromDate, toDate, names);
  }

  async #getClosingPrices(symbols: string[], targetDate: Date): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    // Fetch a 5-day window around the target date to account for holidays
    const start = new Date(targetDate);
    const end = new Date(targetDate);
    end.setDate(end.getDate() + 5);

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const batchPrices = await this.#fetchClosingPricesForBatch(batch, start, end);

      for (const [symbol, price] of batchPrices) {
        prices.set(symbol, price);
      }
    }

    return prices;
  }

  async #fetchClosingPricesForBatch(symbols: string[], start: Date, end: Date): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    const response = await this.#api.getStockBars({
      end: end.toISOString(),
      feed: 'iex',
      limit: 10_000,
      start: start.toISOString(),
      symbols: symbols.join(','),
      timeframe: '1Day',
    });

    for (const [symbol, symbolBars] of Object.entries(response.bars)) {
      if (symbolBars.length > 0) {
        // Use the first available bar's close as the price near the target date
        result.set(symbol, symbolBars[0].c);
      }
    }

    return result;
  }

  #formatResults(results: RankedMomentum[], fromDate: string, toDate: string, names: Map<string, string>) {
    const top = 20;
    const lines: string[] = [];

    lines.push(`**S&P 500 Momentum: ${fromDate} → ${toDate}**`);
    lines.push('');

    const winners = results.slice(0, top);
    const losers = results.slice(-top).reverse();

    const stockColWidth = Math.max(
      'Stock'.length,
      ...winners.map(r => formatSymbolWithName(r.ticker, names, TELEGRAM_TABLE_NAME_MAX).length),
      ...losers.map(r => formatSymbolWithName(r.ticker, names, TELEGRAM_TABLE_NAME_MAX).length)
    );

    const header = `Rank  ${'Stock'.padEnd(stockColWidth)}  ${'12m Ret'.padStart(9)}  ${'Price'.padStart(9)}`;
    const divider = `----  ${'-'.repeat(stockColWidth)}  ---------  ---------`;

    const renderRow = (displayRank: number, r: RankedMomentum) => {
      // Rank number right-aligned, then a single arrow slot so columns stay aligned with or without movement.
      const rank = String(displayRank).padStart(3) + (rankDeltaIcon(r.rankDelta) || ' ');
      const stock = formatSymbolWithName(r.ticker, names, TELEGRAM_TABLE_NAME_MAX).padEnd(stockColWidth);
      const ret = (r.returnPct.toFixed(2) + '%').padStart(9);
      const price = ('$' + r.priceNow.toFixed(2)).padStart(9);
      return `${rank}  ${stock}  ${ret}  ${price}`;
    };

    lines.push(`**Top ${winners.length} Winners (12m return)**`);
    lines.push('```');
    lines.push(header);
    lines.push(divider);
    for (const winner of winners) {
      lines.push(renderRow(winner.rank, winner));
    }
    lines.push('```');

    lines.push(MESSAGE_BREAK);
    lines.push(`**Bottom ${losers.length} Losers (12m return)**`);
    lines.push('```');
    lines.push(header);
    lines.push(divider);
    for (let i = 0; i < losers.length; i++) {
      lines.push(renderRow(i + 1, losers[i]));
    }
    lines.push('```');

    lines.push('');
    lines.push(
      `Price = close on ${toDate} (formation-window end), not the live quote — the 12-1 window skips the most recent month.`
    );
    lines.push('Next to the rank: ▲/▼ = moved up/down vs last month, ★ = new entry.');
    lines.push(`Stocks ranked: ${results.length} / ${SP500_TICKERS.length}`);

    lines.push('');
    lines.push(
      '**Recommendation (based on 12-1 momentum, 3-month hold):** Hold the top winners for 3 months, then re-evaluate.'
    );

    // Disclaimer
    lines.push('');
    lines.push(
      'This report implements the 12-1 cross-sectional momentum strategy as described by Jegadeesh & Titman (1993). ' +
        'Their research found that buying past winners and selling past losers yields significant positive returns, ' +
        'a finding replicated across 40+ countries and 200+ years of data. ' +
        'The 12-month formation / 3-month holding combination produced the highest average monthly return of 1.01% ' +
        'in the original study (Wiest, 2023, doi:10.1007/s11408-022-00417-8). ' +
        'However, momentum strategies are subject to sharp drawdowns (especially during market reversals), ' +
        'and past performance does not guarantee future results. ' +
        'Always do your own research and make informed decisions before trading.'
    );

    return lines.join('\n');
  }
}
