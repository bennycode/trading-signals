import {z} from 'zod';
import {AlpacaAPI} from '@typedtrader/exchange';
import {MESSAGE_BREAK, Report} from '../report/Report.js';
import {fetchUsEquityNames, formatSymbolWithName, TELEGRAM_TABLE_NAME_MAX} from '../util/formatSymbolWithName.js';
import {SP500_TICKERS} from '../util/sp500Tickers.js';

export const SP500HeatmapSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

export type SP500HeatmapConfig = z.infer<typeof SP500HeatmapSchema>;

interface HeatmapResult {
  ticker: string;
  prevClose: number;
  price: number;
  changePct: number;
}

type DayClassification = 'Green' | 'Red' | 'Mixed';

const BATCH_SIZE = 1000;
const GREEN_RETURN_THRESHOLD_PCT = 0.3;
const RED_RETURN_THRESHOLD_PCT = -0.3;
const GREEN_BREADTH_THRESHOLD_PCT = 55;
const RED_BREADTH_THRESHOLD_PCT = 45;

export class SP500HeatmapReport extends Report<SP500HeatmapConfig> {
  static override NAME = '@typedtrader/report-sp500-heatmap';

  readonly #api: AlpacaAPI;

  constructor(config: SP500HeatmapConfig) {
    super(config);
    this.#api = new AlpacaAPI({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      usePaperTrading: false,
    });
  }

  async run(): Promise<string> {
    const [results, names] = await Promise.all([this.#fetchIntradayChanges(SP500_TICKERS), fetchUsEquityNames(this.#api)]);

    results.sort((a, b) => b.changePct - a.changePct);

    return this.#formatResults(results, names);
  }

  async #fetchIntradayChanges(symbols: string[]): Promise<HeatmapResult[]> {
    const results: HeatmapResult[] = [];

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const response = await this.#api.getStockSnapshots({
        symbols: batch.join(','),
        feed: 'iex',
      });

      for (const [ticker, snapshot] of Object.entries(response)) {
        const price = snapshot.latestTrade?.p ?? snapshot.dailyBar?.c;
        const prevClose = snapshot.prevDailyBar?.c;
        if (price != null && prevClose != null && prevClose > 0) {
          results.push({
            ticker,
            prevClose,
            price,
            changePct: ((price - prevClose) / prevClose) * 100,
          });
        }
      }
    }

    return results;
  }

  #formatResults(results: HeatmapResult[], names: Map<string, string>): string {
    const reportDate = new Date().toISOString().slice(0, 10);
    const total = results.length;
    const upCount = results.filter(r => r.changePct > 0).length;
    const breadthPct = total > 0 ? (upCount / total) * 100 : 0;
    const equalWeightedReturnPct = total > 0 ? results.reduce((sum, r) => sum + r.changePct, 0) / total : 0;
    const classification = classifyDay(equalWeightedReturnPct, breadthPct);

    const lines: string[] = [];

    lines.push(`**S&P 500 Heatmap: ${reportDate}**`);
    lines.push('');
    lines.push(`Classification: **${classification}**`);
    lines.push(`Breadth (% up): ${breadthPct.toFixed(1)}% (${upCount} / ${total})`);
    lines.push(`Equal-weighted return: ${equalWeightedReturnPct.toFixed(2)}%`);
    lines.push('');

    const top = 20;
    const winners = results.slice(0, top);
    const losers = results.slice(-top).reverse();

    const stockColWidth = Math.max(
      'Stock'.length,
      ...winners.map(r => formatSymbolWithName(r.ticker, names, TELEGRAM_TABLE_NAME_MAX).length),
      ...losers.map(r => formatSymbolWithName(r.ticker, names, TELEGRAM_TABLE_NAME_MAX).length)
    );

    const renderRow = (index: number, r: HeatmapResult): string => {
      const stock = formatSymbolWithName(r.ticker, names, TELEGRAM_TABLE_NAME_MAX).padEnd(stockColWidth);
      return `${String(index).padStart(4)}  ${stock}  ${(r.changePct.toFixed(2) + '%').padStart(8)}  ${('$' + r.price.toFixed(2)).padStart(9)}`;
    };

    lines.push(`**Top ${winners.length} Gainers (intraday)**`);
    lines.push('```');
    lines.push(`Rank  ${'Stock'.padEnd(stockColWidth)}  Change    Price`);
    lines.push(`----  ${'-'.repeat(stockColWidth)}  --------  ---------`);
    for (let i = 0; i < winners.length; i++) {
      lines.push(renderRow(i + 1, winners[i]));
    }
    lines.push('```');

    lines.push(MESSAGE_BREAK);
    lines.push(`**Top ${losers.length} Losers (intraday)**`);
    lines.push('```');
    lines.push(`Rank  ${'Stock'.padEnd(stockColWidth)}  Change    Price`);
    lines.push(`----  ${'-'.repeat(stockColWidth)}  --------  ---------`);
    for (let i = 0; i < losers.length; i++) {
      lines.push(renderRow(i + 1, losers[i]));
    }
    lines.push('```');

    lines.push('');
    lines.push(`Constituents covered: ${total} / ${SP500_TICKERS.length}`);

    lines.push('');
    lines.push(
      'This report classifies the trading day by combining breadth (share of constituents trading up) ' +
        'with the equal-weighted average intraday return across S&P 500 constituents. ' +
        `The day is labeled **Green** when return > +${GREEN_RETURN_THRESHOLD_PCT}% and breadth > ${GREEN_BREADTH_THRESHOLD_PCT}%, ` +
        `**Red** when return < ${RED_RETURN_THRESHOLD_PCT}% and breadth < ${RED_BREADTH_THRESHOLD_PCT}%, otherwise **Mixed**. ` +
        'Note that an equal-weighted average gives each constituent the same influence, which differs from the ' +
        'cap-weighted SPX index: a handful of mega-caps can drive the official index in a direction that diverges ' +
        'from broad participation. This makes the report useful as a breadth indicator, not as a tracker of SPX itself.'
    );
    lines.push('');
    lines.push('Compare with the live heatmap: https://finviz.com/map.ashx');

    return lines.join('\n');
  }
}

export function classifyDay(equalWeightedReturnPct: number, breadthPct: number): DayClassification {
  if (equalWeightedReturnPct < RED_RETURN_THRESHOLD_PCT && breadthPct < RED_BREADTH_THRESHOLD_PCT) {
    return 'Red';
  }
  if (equalWeightedReturnPct > GREEN_RETURN_THRESHOLD_PCT && breadthPct > GREEN_BREADTH_THRESHOLD_PCT) {
    return 'Green';
  }
  return 'Mixed';
}
