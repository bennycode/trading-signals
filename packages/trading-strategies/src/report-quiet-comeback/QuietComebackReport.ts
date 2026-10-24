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
 * Names stocks that spent weeks or months below a high of magnitude and have started climbing back toward
 * it without having reached it yet.
 *
 * This is a triage list, not a buy signal, and the distinction is measured rather than cautionary.
 * Over 2016-2026 on the S&P 500 and on an independent mid-cap universe, entering on this setup
 * returned the same as the market: the climb up to the level earns 2-3% over the market, but only
 * 20-30% of setups ever reach it and the rest give that back. The 21 days *after* a cross were
 * negative in all 16 configurations tested across both universes, so there is nothing to collect
 * by holding through one. Holding longer is worse rather than better: across 24 exit and level
 * variants, including intraday highs in place of closing highs and three trailing stops, the
 * median trade trailed the market in every one, and the win rate fell the longer a position was
 * held, from 44% at 17 days to 38% at 41. The move reverts, so an exit that leaves it room only
 * gives more back.
 *
 * The opposite construction fails too, which is worth knowing before anyone builds it: buying the
 * breakout from a tight base near the highs, the momentum-shaped version of the same story, lost
 * 1.7% to 3.2% against the market over 63 days in all 18 variants tried, on both the unseen half
 * and the independent universe (t as low as -4.93). Neither buying the laggard before it reclaims
 * an old high nor buying the leader as it clears one paid in this sample.
 *
 * What survived both universes is the downside of the ranking: the slowest recoveries
 * underperformed, which is why {@link rankQuietComebacks} drops them.
 *
 * The three non-price avenues worth trying were tested and closed, recorded here so they are not re-run. Insider buying ahead
 * of a setup, joined from the SEC Form 345 data sets by filing date over the same decade, made
 * outcomes worse rather than better: where insiders were net buyers in the prior 90 days the
 * excess return was -2.27% and -3.02% per month (t = -2.93 and -3.67) in two of three samples, and
 * the cross rate fell. Short interest, joined from FINRA Reg SHO consolidated short volume over
 * the same decade, fails the squeeze thesis it was meant to test: the most heavily shorted
 * quartile of setups did worse, by -3.27% per month (t = -3.59) in the independent universe, and
 * shorts covering ahead of the signal did not help either. Reported earnings, taken from the SEC
 * XBRL frames and treated as public 60 days after period end, are the third: setups whose earnings
 * were both up year on year and accelerating still returned -0.57%, -0.11% and -0.60% per month.
 * Only the downside replicates there too, deteriorating earnings costing -1.30% (t = -4.10).
 * And requiring a meaningful fall from
 * the level, rather than any high at all, selects a population that trails the market in every
 * sample (-0.57% to -0.76% per month).
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
