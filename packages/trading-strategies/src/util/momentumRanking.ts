import type {AlpacaAPI} from '@typedtrader/exchange';
import {SP500_TICKERS} from './sp500Tickers.js';

const BATCH_SIZE = 1000;

export interface MomentumResult {
  ticker: string;
  priceNow: number;
  price12MonthsAgo: number;
  returnPct: number;
}

/**
 * Closing price near a target date for each symbol. Fetches a 5-day window so a holiday on the exact
 * anchor date doesn't leave a hole, and takes the first available bar at or after the date.
 */
export async function fetchClosingPrices(
  api: AlpacaAPI,
  symbols: string[],
  targetDate: Date
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  const start = new Date(targetDate);
  const end = new Date(targetDate);
  end.setDate(end.getDate() + 5);

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const response = await api.getStockBars({
      end: end.toISOString(),
      feed: 'iex',
      limit: 10_000,
      start: start.toISOString(),
      symbols: batch.join(','),
      timeframe: '1Day',
    });
    for (const [symbol, symbolBars] of Object.entries(response.bars)) {
      if (symbolBars.length > 0) {
        prices.set(symbol, symbolBars[0].c);
      }
    }
  }

  return prices;
}

/** Ranks every ticker with a usable price pair by its window return, best first. */
export function rankByMomentum(endPrices: Map<string, number>, startPrices: Map<string, number>): MomentumResult[] {
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

/** Fetches both anchors of a momentum window and returns the S&P 500 ranking, best first. */
export async function getMomentumRanking(
  api: AlpacaAPI,
  window: {pastDate: Date; recentDate: Date}
): Promise<MomentumResult[]> {
  const [endPrices, startPrices] = await Promise.all([
    fetchClosingPrices(api, SP500_TICKERS, window.recentDate),
    fetchClosingPrices(api, SP500_TICKERS, window.pastDate),
  ]);
  return rankByMomentum(endPrices, startPrices);
}
