import {z} from 'zod';
import {AlpacaAPI} from '@typedtrader/exchange';
import {Report} from '../report/Report.js';
import {SP500_TICKERS} from '../util/sp500Tickers.js';
import {fetchUsEquityNames, formatSymbolWithName, TELEGRAM_TABLE_NAME_MAX} from '../util/formatSymbolWithName.js';
import {
  findQuietComeback,
  QUIET_COMEBACK_DEFAULTS,
  rankQuietComebacks,
  type QuietComebackCandidate,
} from './findQuietComeback.js';

export const QuietComebackSchema = z.object({
  /**
   * Trading days a stock must have spent below the level before it counts as quiet. Shortening it
   * to a few weeks roughly doubles the candidates and raises the share that reach their level
   * (42.8% at 10 days against 41.7% at 60 on the S&P 500, and 48.6% against 45.7% on a further
   * 1,235 symbols), without changing the return, which stayed flat at every setting tested.
   */
  minQuietDays: z.number().int().min(10).max(250).optional().default(60),
  /** Share of the slowest recoveries to drop from the ranked list. */
  slowestShare: z.number().min(0).max(0.9).optional().default(0.3),
  symbols: z.array(z.string()).optional(),
});

export type QuietComebackConfig = z.infer<typeof QuietComebackSchema>;

const BATCH_SIZE = 100;
/**
 * Alpaca's free data plan serves SIP history but refuses the most recent 15 minutes, so a request
 * ending at `now` is rejected with "subscription does not permit querying recent SIP data".
 * Daily bars are unaffected by ending the window slightly earlier.
 */
const SIP_DELAY_MS = 20 * 60 * 1000;
/** Enough calendar days to cover the 250 trading days the setup looks back over. */
const CALENDAR_DAYS = 400;

/**
 * Names stocks that went quiet below a high of magnitude and have started climbing back toward it
 * without having reached it yet.
 *
 * A triage list, not a buy signal, and that distinction is measured rather than cautionary:
 * entering on this setup returned what the market returned, and the weeks after a level is crossed
 * were slightly negative. The report says where to look, never what to buy. RESEARCH.md records
 * what was measured, including five avenues that were tried and closed.
 */
export class QuietComebackReport extends Report<QuietComebackConfig> {
  static override NAME = '@typedtrader/report-quiet-comeback';

  readonly #api: AlpacaAPI;

  constructor(config: QuietComebackConfig, api: AlpacaAPI) {
    super(config);
    this.#api = api;
  }

  override async run(): Promise<string> {
    const symbols = this.config.symbols ?? SP500_TICKERS;
    const end = new Date(Date.now() - SIP_DELAY_MS);
    const start = new Date(end.getTime() - CALENDAR_DAYS * 24 * 60 * 60 * 1000);

    const candidates: QuietComebackCandidate[] = [];
    let scanned = 0;
    for (let index = 0; index < symbols.length; index += BATCH_SIZE) {
      const batch = symbols.slice(index, index + BATCH_SIZE);
      const closes = await this.#fetchCloses(batch, start, end);
      for (const [symbol, series] of closes) {
        scanned++;
        const found = findQuietComeback(symbol, series, {
          ...QUIET_COMEBACK_DEFAULTS,
          minQuietDays: this.config.minQuietDays,
        });
        if (found) {
          candidates.push(found);
        }
      }
    }

    const names = await fetchUsEquityNames(this.#api);
    return this.#format(rankQuietComebacks(candidates, this.config.slowestShare), {
      asOf: end,
      matched: candidates.length,
      names,
      scanned,
    });
  }

  async #fetchCloses(symbols: string[], start: Date, end: Date): Promise<Map<string, number[]>> {
    const closes = new Map<string, number[]>();
    let pageToken: string | undefined;
    do {
      const response = await this.#api.getStockBars({
        adjustment: AlpacaAPI.CONTINUOUS_PRICE_ADJUSTMENT,
        end: end.toISOString(),
        limit: 10_000,
        ...(pageToken ? {page_token: pageToken} : {}),
        start: start.toISOString(),
        symbols: symbols.join(','),
        timeframe: '1Day',
      });
      for (const [symbol, bars] of Object.entries(response.bars)) {
        const series = closes.get(symbol) ?? [];
        series.push(...bars.map(bar => bar.c));
        closes.set(symbol, series);
      }
      pageToken = response.next_page_token ?? undefined;
    } while (pageToken);
    return closes;
  }

  #format(
    ranked: QuietComebackCandidate[],
    context: {asOf: Date; matched: number; names: Map<string, string>; scanned: number}
  ): string {
    const {asOf, matched, names, scanned} = context;
    const lines: string[] = [];
    const asOfDate = asOf.toISOString().slice(0, 10);
    lines.push(`**Quiet Comebacks: ${asOfDate}**`);
    lines.push('');

    if (ranked.length === 0) {
      lines.push(`No stock is currently climbing back toward a high it fell away from (${scanned} scanned).`);
      return lines.join('\n');
    }

    const stockWidth = Math.max(
      'Stock'.length,
      ...ranked.map(entry => formatSymbolWithName(entry.symbol, names, TELEGRAM_TABLE_NAME_MAX).length)
    );
    lines.push('```');
    lines.push(
      `${'Stock'.padEnd(stockWidth)}  ${'Price'.padStart(9)}  ${'Level'.padStart(9)}  ${'To go'.padStart(7)}  ${'Quiet'.padStart(6)}  ${'Fell'.padStart(7)}  ${'%/day'.padStart(6)}  ${'Cross?'.padStart(6)}`
    );
    lines.push(`${'-'.repeat(stockWidth)}  ---------  ---------  -------  ------  -------  ------`);
    for (const entry of ranked) {
      lines.push(
        `${formatSymbolWithName(entry.symbol, names, TELEGRAM_TABLE_NAME_MAX).padEnd(stockWidth)}  ` +
          `${`$${entry.close.toFixed(2)}`.padStart(9)}  ${`$${entry.level.toFixed(2)}`.padStart(9)}  ` +
          `${`${(-entry.gapToLevel * 100).toFixed(2)}%`.padStart(7)}  ${`${entry.quietDays}d`.padStart(6)}  ` +
          `${`${(entry.drawdown * 100).toFixed(1)}%`.padStart(7)}  ${`${(entry.gainPerDay * 100).toFixed(2)}%`.padStart(6)}  ` +
          `${(entry.likelyToCross ? 'likely' : '-').padStart(6)}`
      );
    }
    lines.push('```');
    lines.push('');
    lines.push(`Level = the high it fell away from. To go = how far below it still trades.`);
    lines.push(`Quiet = days since it last closed at that level. %/day = share of the climb earned per day.`);
    lines.push(
      `Cross? = reached its level materially more often in testing (51% vs 45%), which says nothing about return.`
    );
    lines.push(
      `${matched} of ${scanned} matched at ${this.config.minQuietDays}+ quiet days; the slowest ${Math.round(this.config.slowestShare * 100)}% are excluded.`
    );
    lines.push('');
    lines.push(
      '**This is a watchlist, not a buy list.** Entering on this setup historically matched the market, ' +
        'and the weeks after a level is crossed were slightly negative. Use it to decide what to look at.'
    );
    return lines.join('\n');
  }
}
