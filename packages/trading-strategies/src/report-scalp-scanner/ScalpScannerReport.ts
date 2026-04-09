import {z} from 'zod';
import {AlpacaAPI} from '@typedtrader/exchange';
import type {Bar} from '@typedtrader/exchange';
import {ER} from 'trading-signals';
import {MESSAGE_BREAK, Report} from '../report/Report.js';
import {SP500_TICKERS} from '../report-sp500-momentum/sp500Tickers.js';
import {ScalpStrategy} from '../strategy-scalp/ScalpStrategy.js';
import {suggestScalpOffset} from '../strategy-scalp/suggestScalpOffset.js';
import {fetchUsEquityNames, formatSymbolWithName} from '../util/formatSymbolWithName.js';

export const ScalpScannerSchema = z.object({
  /** Alpaca API key */
  apiKey: z.string().min(1),
  /** Alpaca API secret */
  apiSecret: z.string().min(1),
  /** Stock symbols to scan (defaults to S&P 500) */
  symbols: z.array(z.string()).optional(),
  /** Number of trading days to analyze (default: 60, ~3 months) */
  lookbackDays: z.number().int().positive().optional().default(60),
  /** ER threshold below which a stock is considered scalp-friendly (default: 0.4) */
  erThreshold: z.number().positive().optional().default(ScalpStrategy.ER_THRESHOLD),
});

export type ScalpScannerConfig = z.infer<typeof ScalpScannerSchema>;

interface ScanResult {
  symbol: string;
  er: number;
  atrPct: number;
  suggestedOffset: string;
  priceStart: number;
  priceEnd: number;
  netChangePct: number;
}

interface DailyBar {
  close: number;
  high: number;
  low: number;
}

const BATCH_SIZE = 50;

export class ScalpScannerReport extends Report<ScalpScannerConfig> {
  static override NAME = '@typedtrader/report-scalp-scanner';

  readonly #api: AlpacaAPI;

  constructor(config: ScalpScannerConfig) {
    super(config);
    this.#api = new AlpacaAPI({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      usePaperTrading: false,
    });
  }

  async run(): Promise<string> {
    const symbols = this.config.symbols ?? SP500_TICKERS;
    const end = new Date();
    // Fetch extra calendar days to account for weekends/holidays
    const start = new Date(end.getTime() - this.config.lookbackDays * 1.5 * 86_400_000);

    const [allBars, names] = await Promise.all([
      this.#fetchAllBars(symbols, start, end),
      fetchUsEquityNames(this.#api),
    ]);
    const results: ScanResult[] = [];

    for (const symbol of symbols) {
      const bars = allBars.get(symbol);
      if (!bars || bars.length === 0) {
        continue;
      }

      // Trim to the most recent `lookbackDays` trading days so the analysis window
      // matches the documented behavior regardless of weekends/holidays.
      const allDaily = this.#aggregateToDailyBars(bars);
      const daily = allDaily.slice(-this.config.lookbackDays);
      if (daily.length < 14) {
        continue;
      }

      const er = new ER(daily.length);
      for (const bar of daily) {
        er.add(bar);
      }

      const erValue = er.getResultOrThrow();
      const firstClose = daily[0].close;
      const lastClose = daily[daily.length - 1].close;
      const netChangePct = ((lastClose / firstClose) - 1) * 100;

      // Compute ATR% for context
      const exchangeCandles = daily.map((bar, i) => ({
        base: symbol,
        close: String(bar.close),
        counter: 'USD',
        high: String(bar.high),
        low: String(bar.low),
        open: String(bar.close),
        openTimeInISO: new Date(start.getTime() + i * 86_400_000).toISOString(),
        openTimeInMillis: start.getTime() + i * 86_400_000,
        sizeInMillis: 86_400_000,
        volume: '0',
      }));

      let offsetStr = 'N/A';
      try {
        const offset = suggestScalpOffset(exchangeCandles);
        offsetStr = '$' + offset.toFixed(2);
      } catch {
        // Not enough data for ATR
      }

      // ATR approximation: average daily range / average price
      const avgRange = daily.reduce((sum, b) => sum + (b.high - b.low), 0) / daily.length;
      const avgPrice = daily.reduce((sum, b) => sum + b.close, 0) / daily.length;
      const atrPct = (avgRange / avgPrice) * 100;

      results.push({
        symbol,
        er: erValue,
        atrPct,
        suggestedOffset: offsetStr,
        priceStart: firstClose,
        priceEnd: lastClose,
        netChangePct,
      });
    }

    const scalpFriendly = results
      .filter(r => r.er < this.config.erThreshold)
      .sort((a, b) => a.er - b.er);

    const trending = results
      .filter(r => r.er >= this.config.erThreshold)
      .sort((a, b) => b.er - a.er);

    return this.#formatResults(scalpFriendly, trending, results.length, names);
  }

  async #fetchAllBars(symbols: string[], start: Date, end: Date): Promise<Map<string, Bar[]>> {
    const allBars = new Map<string, Bar[]>();

    // Batch symbols to avoid URL length limits
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const batchBars = await this.#fetchBarsForSymbols(batch, start, end);

      for (const [symbol, bars] of batchBars) {
        allBars.set(symbol, bars);
      }
    }

    return allBars;
  }

  async #fetchBarsForSymbols(symbols: string[], start: Date, end: Date): Promise<Map<string, Bar[]>> {
    const result = new Map<string, Bar[]>();
    let pageToken: string | undefined;

    do {
      const response = await this.#api.getStockBars({
        symbols: symbols.join(','),
        timeframe: '1Day',
        start: start.toISOString(),
        end: end.toISOString(),
        feed: 'iex',
        limit: 10_000,
        page_token: pageToken,
      });

      for (const [symbol, symbolBars] of Object.entries(response.bars)) {
        const existing = result.get(symbol) ?? [];
        existing.push(...symbolBars);
        result.set(symbol, existing);
      }

      pageToken = response.next_page_token ?? undefined;
    } while (pageToken);

    return result;
  }

  #aggregateToDailyBars(bars: Bar[]): DailyBar[] {
    const dayMap = new Map<string, DailyBar>();

    for (const bar of bars) {
      const day = bar.t.slice(0, 10);
      const existing = dayMap.get(day);

      if (!existing) {
        dayMap.set(day, {close: bar.c, high: bar.h, low: bar.l});
      } else {
        if (bar.h > existing.high) existing.high = bar.h;
        if (bar.l < existing.low) existing.low = bar.l;
        existing.close = bar.c;
      }
    }

    return [...dayMap.values()];
  }

  #formatResults(scalpFriendly: ScanResult[], trending: ScanResult[], total: number, names: Map<string, string>): string {
    const lines: string[] = [];
    const top = 20;

    const scalpFriendlyTop = scalpFriendly.slice(0, top);
    const trendingTop = trending.slice(0, top);

    const tableNameMax = 22;
    const stockColWidth = Math.max(
      'Stock'.length,
      ...scalpFriendlyTop.map(r => formatSymbolWithName(r.symbol, names, tableNameMax).length),
      ...trendingTop.map(r => formatSymbolWithName(r.symbol, names, tableNameMax).length)
    );

    const formatNet = (pct: number): string => (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';

    // Message 1: header + top scalp-friendly table
    lines.push(`**Scalp Scanner: ${total} stocks analyzed**`);
    lines.push(`Lookback: ${this.config.lookbackDays} trading days | ER threshold: ${this.config.erThreshold}`);
    lines.push('');
    lines.push(`**Top ${scalpFriendlyTop.length} Scalp-Friendly Stocks (lowest ER = most choppy)**`);
    lines.push('```');
    lines.push(`Rank  ${'Stock'.padEnd(stockColWidth)}  ER     ATR%    Offset   Net      Price`);
    lines.push(`----  ${'-'.repeat(stockColWidth)}  -----  ------  -------  -------  --------`);
    for (let i = 0; i < scalpFriendlyTop.length; i++) {
      const r = scalpFriendlyTop[i];
      const stock = formatSymbolWithName(r.symbol, names, tableNameMax).padEnd(stockColWidth);
      lines.push(
        `${String(i + 1).padStart(4)}  ${stock}  ${r.er.toFixed(2).padStart(5)}  ${(r.atrPct.toFixed(1) + '%').padStart(6)}  ${r.suggestedOffset.padStart(7)}  ${formatNet(r.netChangePct).padStart(7)}  ${('$' + r.priceEnd.toFixed(2)).padStart(8)}`
      );
    }
    lines.push('```');

    // Message 2: top trending table
    lines.push(MESSAGE_BREAK);
    lines.push(`**Top ${trendingTop.length} Trending Stocks (highest ER = most directional)**`);
    lines.push('```');
    lines.push(`Rank  ${'Stock'.padEnd(stockColWidth)}  ER     ATR%    Net      Price`);
    lines.push(`----  ${'-'.repeat(stockColWidth)}  -----  ------  -------  --------`);
    for (let i = 0; i < trendingTop.length; i++) {
      const r = trendingTop[i];
      const stock = formatSymbolWithName(r.symbol, names, tableNameMax).padEnd(stockColWidth);
      lines.push(
        `${String(i + 1).padStart(4)}  ${stock}  ${r.er.toFixed(2).padStart(5)}  ${(r.atrPct.toFixed(1) + '%').padStart(6)}  ${formatNet(r.netChangePct).padStart(7)}  ${('$' + r.priceEnd.toFixed(2)).padStart(8)}`
      );
    }
    lines.push('```');

    // Message 3: top picks + summary + disclaimer
    lines.push(MESSAGE_BREAK);
    const pickCount = 5;
    const picks = scalpFriendly.filter(r => r.atrPct >= 2.0).slice(0, pickCount);
    if (picks.length > 0) {
      lines.push(`**Top Picks for Scalping (low ER + ATR >= 2%):**`);
      for (const r of picks) {
        lines.push(`- ${formatSymbolWithName(r.symbol, names)} (ER: ${r.er.toFixed(2)}, ATR: ${r.atrPct.toFixed(1)}%, offset: ${r.suggestedOffset}, price: $${r.priceEnd.toFixed(2)})`);
      }
    } else {
      lines.push(`No strong scalp candidates found (need low ER + ATR >= 2%).`);
    }

    // Summary
    lines.push('');
    lines.push(`Summary: ${scalpFriendly.length} scalp-friendly / ${trending.length} trending / ${total} total`);

    // Disclaimer
    lines.push('');
    lines.push('This report is for informational purposes only. Always do your own research and make informed decisions before trading. Past range efficiency does not guarantee future price behavior.');

    return lines.join('\n');
  }
}
