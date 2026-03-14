import {z} from 'zod';
import {restClient} from '@massive.com/client-js';
import {Report} from '../report/Report.js';
import {SP500_TICKERS} from './sp500Tickers.js';

export const SP500MomentumSchema = z.object({
  apiKey: z.string().min(1),
});

export type SP500MomentumConfig = z.infer<typeof SP500MomentumSchema>;

interface MomentumResult {
  ticker: string;
  priceNow: number;
  price12MonthsAgo: number;
  returnPct: number;
}

interface Bar {
  T?: string;
  c?: number;
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function findLastTradingDay(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() - 2);
  else if (day === 6) d.setDate(d.getDate() - 1);
  return d;
}

export class SP500MomentumReport extends Report {
  static override NAME = '@typedtrader/report-sp500-momentum';

  constructor(config: SP500MomentumConfig) {
    super(config);
  }

  async run(): Promise<string> {
    const rest = restClient(this.config.apiKey as string);

    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const recentDate = findLastTradingDay(new Date(now.getTime() - 2 * 86_400_000));
    const pastDate = findLastTradingDay(twelveMonthsAgo);

    const toDate = getDateString(recentDate);
    const fromDate = getDateString(pastDate);

    const [currentPrices, pastPrices] = await Promise.all([
      this.#getClosingPrices(rest, toDate),
      this.#getClosingPrices(rest, fromDate),
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

    return this.#formatResults(results, fromDate, toDate);
  }

  async #getClosingPrices(rest: ReturnType<typeof restClient>, date: string): Promise<Map<string, number>> {
    const response = await rest.getGroupedStocksAggregates({date});
    const bars: Bar[] = response.results ?? [];
    const prices = new Map<string, number>();
    for (const bar of bars) {
      if (bar.T && bar.c != null) {
        prices.set(bar.T, bar.c);
      }
    }
    return prices;
  }

  #formatResults(results: MomentumResult[], fromDate: string, toDate: string): string {
    const top = 20;
    const lines: string[] = [];

    lines.push(`S&P 500 Momentum: ${fromDate} → ${toDate}`);
    lines.push('');
    lines.push(`**Top ${top} Winners (12m return)**`);
    lines.push('```');
    lines.push('Rank  Ticker     12m Return    Price Now    Price 12m Ago');
    lines.push('----  ------     ----------    ---------    -------------');

    for (let i = 0; i < Math.min(top, results.length); i++) {
      const r = results[i];
      lines.push(
        `${String(i + 1).padStart(4)}  ${r.ticker.padEnd(10)} ${r.returnPct.toFixed(2).padStart(9)}%    $${r.priceNow.toFixed(2).padStart(8)}    $${r.price12MonthsAgo.toFixed(2).padStart(8)}`
      );
    }
    lines.push('```');

    lines.push('');
    lines.push(`**Bottom ${top} Losers (12m return)**`);
    lines.push('```');
    lines.push('Rank  Ticker     12m Return    Price Now    Price 12m Ago');
    lines.push('----  ------     ----------    ---------    -------------');

    const bottom = results.slice(-top).reverse();
    for (let i = 0; i < bottom.length; i++) {
      const r = bottom[i];
      lines.push(
        `${String(i + 1).padStart(4)}  ${r.ticker.padEnd(10)} ${r.returnPct.toFixed(2).padStart(9)}%    $${r.priceNow.toFixed(2).padStart(8)}    $${r.price12MonthsAgo.toFixed(2).padStart(8)}`
      );
    }
    lines.push('```');

    lines.push('');
    lines.push(`Stocks ranked: ${results.length} / ${SP500_TICKERS.length}`);

    return lines.join('\n');
  }
}
