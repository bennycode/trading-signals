import {restClient} from '@massive.com/client-js';
import {SP500_TICKERS} from './sp500Tickers.js';

const apiKey = process.env.MASSIVE_API_KEY;
if (!apiKey) {
  console.error('Missing MASSIVE_API_KEY environment variable');
  process.exit(1);
}

const rest = restClient(apiKey);

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
  const day = date.getDay();
  if (day === 0) date.setDate(date.getDate() - 2); // Sunday → Friday
  if (day === 6) date.setDate(date.getDate() - 1); // Saturday → Friday
  return date;
}

async function getClosingPrices(date: string): Promise<Map<string, number>> {
  const response = await rest.getGroupedStocksAggregates({date});
  const results: Bar[] = response.results ?? [];
  const prices = new Map<string, number>();
  for (const bar of results) {
    if (bar.T && bar.c != null) {
      prices.set(bar.T, bar.c);
    }
  }
  return prices;
}

async function main() {
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const recentDate = findLastTradingDay(new Date(now.getTime() - 86_400_000));
  const pastDate = findLastTradingDay(twelveMonthsAgo);

  const toDate = getDateString(recentDate);
  const fromDate = getDateString(pastDate);

  console.log(`Ranking S&P 500 momentum: ${fromDate} → ${toDate}\n`);

  console.log('Fetching current prices...');
  const currentPrices = await getClosingPrices(toDate);

  console.log('Fetching prices from 12 months ago...');
  const pastPrices = await getClosingPrices(fromDate);

  const sp500Set = new Set(SP500_TICKERS);
  const results: MomentumResult[] = [];

  for (const ticker of sp500Set) {
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

  const top = 20;
  console.log(`\n=== Top ${top} Momentum Winners (12-month return) ===\n`);
  console.log('Rank  Ticker     12m Return    Price Now    Price 12m Ago');
  console.log('----  ------     ----------    ---------    -------------');

  for (let i = 0; i < Math.min(top, results.length); i++) {
    const r = results[i];
    console.log(
      `${String(i + 1).padStart(4)}  ${r.ticker.padEnd(10)} ${r.returnPct.toFixed(2).padStart(9)}%    $${r.priceNow.toFixed(2).padStart(8)}    $${r.price12MonthsAgo.toFixed(2).padStart(8)}`
    );
  }

  console.log(`\n=== Bottom ${top} Momentum Losers (12-month return) ===\n`);
  console.log('Rank  Ticker     12m Return    Price Now    Price 12m Ago');
  console.log('----  ------     ----------    ---------    -------------');

  const bottom = results.slice(-top).reverse();
  for (let i = 0; i < bottom.length; i++) {
    const r = bottom[i];
    console.log(
      `${String(i + 1).padStart(4)}  ${r.ticker.padEnd(10)} ${r.returnPct.toFixed(2).padStart(9)}%    $${r.priceNow.toFixed(2).padStart(8)}    $${r.price12MonthsAgo.toFixed(2).padStart(8)}`
    );
  }

  console.log(`\nTotal S&P 500 stocks ranked: ${results.length} / ${SP500_TICKERS.length}`);
}

main().catch(error => {
  console.error('Error:', error.message ?? error);
  process.exit(1);
});
