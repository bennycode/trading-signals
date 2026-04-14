import {z} from 'zod';
import {AlpacaAPI} from '@typedtrader/exchange';
import {MESSAGE_BREAK, Report} from '../report/Report.js';
import {fetchUsEquityNames, formatSymbolWithName, TELEGRAM_TABLE_NAME_MAX} from '../util/formatSymbolWithName.js';
import {findFirstTradingDay, getDateString} from '../util/TimeUtil.js';
import {SP500_TICKERS} from './sp500Tickers.js';

export const SP500MomentumSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

export type SP500MomentumConfig = z.infer<typeof SP500MomentumSchema>;

interface MomentumResult {
  ticker: string;
  priceNow: number;
  price12MonthsAgo: number;
  returnPct: number;
}

const BATCH_SIZE = 50;

export class SP500MomentumReport extends Report<SP500MomentumConfig> {
  static override NAME = '@typedtrader/report-sp500-momentum';

  readonly #api: AlpacaAPI;

  constructor(config: SP500MomentumConfig) {
    super(config);
    this.#api = new AlpacaAPI({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      usePaperTrading: false,
    });
  }

  async run(): Promise<string> {
    const now = new Date();

    // 12-1 momentum: skip the most recent month, look back 12 months from there
    const recentMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const pastMonth = new Date(recentMonth.getFullYear() - 1, recentMonth.getMonth(), 1);

    const recentDate = findFirstTradingDay(recentMonth);
    const pastDate = findFirstTradingDay(pastMonth);

    const toDate = getDateString(recentDate);
    const fromDate = getDateString(pastDate);

    const [currentPrices, pastPrices, names] = await Promise.all([
      this.#getClosingPrices(SP500_TICKERS, recentDate),
      this.#getClosingPrices(SP500_TICKERS, pastDate),
      fetchUsEquityNames(this.#api),
    ]);

    const results: MomentumResult[] = [];

    for (const ticker of SP500_TICKERS) {
      const priceNow = currentPrices.get(ticker);
      const priceThen = pastPrices.get(ticker);
      if (priceNow != null && priceThen != null && priceThen > 0) {
        results.push({
          ticker,
          priceNow,
          price12MonthsAgo: priceThen,
          returnPct: ((priceNow - priceThen) / priceThen) * 100,
        });
      }
    }

    results.sort((a, b) => b.returnPct - a.returnPct);

    return this.#formatResults(results, fromDate, toDate, names);
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
      symbols: symbols.join(','),
      timeframe: '1Day',
      start: start.toISOString(),
      end: end.toISOString(),
      feed: 'iex',
      limit: 10_000,
    });

    for (const [symbol, symbolBars] of Object.entries(response.bars)) {
      if (symbolBars.length > 0) {
        // Use the first available bar's close as the price near the target date
        result.set(symbol, symbolBars[0].c);
      }
    }

    return result;
  }

  #formatResults(results: MomentumResult[], fromDate: string, toDate: string, names: Map<string, string>): string {
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

    const renderRow = (index: number, r: MomentumResult): string => {
      const stock = formatSymbolWithName(r.ticker, names, TELEGRAM_TABLE_NAME_MAX).padEnd(stockColWidth);
      return `${String(index).padStart(4)}  ${stock}  ${(r.returnPct.toFixed(2) + '%').padStart(9)}  ${('$' + r.priceNow.toFixed(2)).padStart(9)}`;
    };

    lines.push(`**Top ${winners.length} Winners (12m return)**`);
    lines.push('```');
    lines.push(`Rank  ${'Stock'.padEnd(stockColWidth)}  12m Ret    Price`);
    lines.push(`----  ${'-'.repeat(stockColWidth)}  ---------  ---------`);
    for (let i = 0; i < winners.length; i++) {
      lines.push(renderRow(i + 1, winners[i]));
    }
    lines.push('```');

    lines.push(MESSAGE_BREAK);
    lines.push(`**Bottom ${losers.length} Losers (12m return)**`);
    lines.push('```');
    lines.push(`Rank  ${'Stock'.padEnd(stockColWidth)}  12m Ret    Price`);
    lines.push(`----  ${'-'.repeat(stockColWidth)}  ---------  ---------`);
    for (let i = 0; i < losers.length; i++) {
      lines.push(renderRow(i + 1, losers[i]));
    }
    lines.push('```');

    lines.push('');
    lines.push(`Stocks ranked: ${results.length} / ${SP500_TICKERS.length}`);

    lines.push('');
    lines.push('**Recommendation (based on 12-1 momentum, 3-month hold):** Hold the top winners for 3 months, then re-evaluate.');

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
