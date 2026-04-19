import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaExchangeMock, ExchangeOrderSide, TradingPair} from '@typedtrader/exchange';
import type {ExchangeCandle} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import type {BacktestConfig} from '../backtest/BacktestConfig.js';
import type {BacktestResult, BacktestTrade} from '../backtest/BacktestResult.js';
import {TrailingHigherLowStrategy} from './TrailingHigherLowStrategy.js';

type DailyBar = {readonly date: string; readonly open: number; readonly high: number; readonly low: number; readonly close: number};

/**
 * AMD daily candles, 2026-01-20 → 2026-04-17 (62 sessions), fetched from Alpaca.
 * Trending regime: +20% over the window with one fake-out (Feb 4 dip) in the middle.
 */
const AMD_DAILY: readonly DailyBar[] = [
  {date: '2026-01-20', open: 226.145, high: 239.47, low: 225.55, close: 231.96},
  {date: '2026-01-21', open: 235.99, high: 252.885, low: 235.965, close: 249.68},
  {date: '2026-01-22', open: 251.61, high: 255.935, low: 246.695, close: 253.71},
  {date: '2026-01-23', open: 261.31, high: 266.95, low: 256.26, close: 259.65},
  {date: '2026-01-26', open: 256.745, high: 258.145, low: 250.335, close: 251.28},
  {date: '2026-01-27', open: 252.305, high: 255.515, low: 248.1, close: 251.95},
  {date: '2026-01-28', open: 254.27, high: 257.26, low: 250.21, close: 252.63},
  {date: '2026-01-29', open: 254.7, high: 260.44, low: 241.01, close: 252.17},
  {date: '2026-01-30', open: 236.93, high: 245.13, low: 234.59, close: 236.8},
  {date: '2026-02-02', open: 235.75, high: 249.94, low: 235.085, close: 246.2},
  {date: '2026-02-03', open: 251.46, high: 252.47, low: 237.155, close: 242.455},
  {date: '2026-02-04', open: 215.095, high: 217.83, low: 199.26, close: 200.16},
  {date: '2026-02-05', open: 201.805, high: 203.95, low: 190.74, close: 192.25},
  {date: '2026-02-06', open: 196.99, high: 209.225, low: 196.47, close: 208.25},
  {date: '2026-02-09', open: 206.895, high: 217.56, low: 204.23, close: 215.88},
  {date: '2026-02-10', open: 215.62, high: 219.35, low: 213.18, close: 213.6},
  {date: '2026-02-11', open: 217.655, high: 219.595, low: 209.32, close: 213.5},
  {date: '2026-02-12', open: 215.46, high: 218.35, low: 205.21, close: 205.91},
  {date: '2026-02-13', open: 204.035, high: 210.01, low: 204.035, close: 207.255},
  {date: '2026-02-17', open: 202.145, high: 205.24, low: 194.94, close: 203.07},
  {date: '2026-02-18', open: 198.56, high: 203.2, low: 195.13, close: 200.1},
  {date: '2026-02-19', open: 200.13, high: 204, low: 198.49, close: 203.39},
  {date: '2026-02-20', open: 200.185, high: 204.84, low: 198.66, close: 200.15},
  {date: '2026-02-23', open: 198.2, high: 199.26, low: 194.26, close: 196.62},
  {date: '2026-02-24', open: 211.63, high: 216.68, low: 206.67, close: 214.04},
  {date: '2026-02-25', open: 214.66, high: 216.38, low: 210.36, close: 210.9},
  {date: '2026-02-26', open: 208.92, high: 209.29, low: 201.51, close: 203.71},
  {date: '2026-02-27', open: 200.105, high: 201.845, low: 197.74, close: 200.375},
  {date: '2026-03-02', open: 193.845, high: 198.73, low: 190, close: 198.57},
  {date: '2026-03-03', open: 191.51, high: 193.59, low: 188.23, close: 191.01},
  {date: '2026-03-04', open: 192.295, high: 202.44, low: 189.905, close: 202.035},
  {date: '2026-03-05', open: 197.65, high: 203.7, low: 194.93, close: 199.43},
  {date: '2026-03-06', open: 195.03, high: 200.1, low: 191.32, close: 192.42},
  {date: '2026-03-09', open: 189.23, high: 202.95, low: 189.22, close: 202.7},
  {date: '2026-03-10', open: 202.75, high: 206.495, low: 202.32, close: 203.28},
  {date: '2026-03-11', open: 205.19, high: 209.14, low: 203.66, close: 204.75},
  {date: '2026-03-12', open: 202.825, high: 203.62, low: 196.69, close: 197.75},
  {date: '2026-03-13', open: 198, high: 199.66, low: 192.29, close: 193.41},
  {date: '2026-03-16', open: 194.86, high: 200.12, low: 194.86, close: 196.66},
  {date: '2026-03-17', open: 196.63, high: 199.14, low: 195.26, close: 196.29},
  {date: '2026-03-18', open: 196, high: 202.86, low: 195.91, close: 199.49},
  {date: '2026-03-19', open: 194.97, high: 205.825, low: 192.91, close: 205.24},
  {date: '2026-03-20', open: 205.225, high: 206.25, low: 198.33, close: 201.36},
  {date: '2026-03-23', open: 206.44, high: 209.06, low: 201.745, close: 202.67},
  {date: '2026-03-24', open: 202.12, high: 206.41, low: 200.24, close: 205.41},
  {date: '2026-03-25', open: 211.645, high: 221.31, low: 211.645, close: 220.28},
  {date: '2026-03-26', open: 218.22, high: 221, low: 203.465, close: 203.74},
  {date: '2026-03-27', open: 201.29, high: 202.98, low: 197.71, close: 201.93},
  {date: '2026-03-30', open: 205.095, high: 208.265, low: 192.915, close: 196.03},
  {date: '2026-03-31', open: 198.28, high: 203.98, low: 196.46, close: 203.25},
  {date: '2026-04-01', open: 207.64, high: 213.775, low: 206.2, close: 210.22},
  {date: '2026-04-02', open: 204.105, high: 217.69, low: 200.69, close: 217.57},
  {date: '2026-04-06', open: 219.455, high: 226.28, low: 217.84, close: 220.17},
  {date: '2026-04-07', open: 219.4, high: 221.99, low: 215.47, close: 221.61},
  {date: '2026-04-08', open: 232.62, high: 233.91, low: 227.11, close: 231.82},
  {date: '2026-04-09', open: 233.435, high: 237.05, low: 231.02, close: 236.64},
  {date: '2026-04-10', open: 239.545, high: 249.5, low: 239.545, close: 245.02},
  {date: '2026-04-13', open: 245.025, high: 247.285, low: 242.08, close: 246.8},
  {date: '2026-04-14', open: 249.79, high: 255.415, low: 245.85, close: 255.09},
  {date: '2026-04-15', open: 255.68, high: 258.17, low: 251.93, close: 258.115},
  {date: '2026-04-16', open: 264.9, high: 279.3, low: 261.7, close: 278.255},
  {date: '2026-04-17', open: 278.28, high: 280.03, low: 274.21, close: 278.29},
];

/**
 * SMCI (Super Micro Computer) daily candles, 2026-01-02 → 2026-04-17 (73 sessions).
 * Falling-knife regime: −33% gap-down crash on 2026-03-20 followed by partial recovery.
 */
const SMCI_DAILY: readonly DailyBar[] = [
  {date: '2026-01-02', open: 29.94, high: 31.385, low: 29.94, close: 30.97},
  {date: '2026-01-05', open: 31.61, high: 32.04, low: 29.98, close: 30.07},
  {date: '2026-01-06', open: 30.58, high: 30.6, low: 29.43, close: 30.535},
  {date: '2026-01-07', open: 30.565, high: 30.575, low: 29.785, close: 30.02},
  {date: '2026-01-08', open: 30.01, high: 30.035, low: 29.215, close: 29.88},
  {date: '2026-01-09', open: 30.015, high: 31.025, low: 29.575, close: 30.14},
  {date: '2026-01-12', open: 29.97, high: 30.525, low: 29.77, close: 30.12},
  {date: '2026-01-13', open: 29.88, high: 29.88, low: 27.8, close: 28.61},
  {date: '2026-01-14', open: 28.23, high: 28.75, low: 27.775, close: 28.275},
  {date: '2026-01-15', open: 28.71, high: 29.85, low: 28.58, close: 29.425},
  {date: '2026-01-16', open: 29.71, high: 32.97, low: 29.64, close: 32.66},
  {date: '2026-01-20', open: 31.21, high: 31.72, low: 30.23, close: 31.41},
  {date: '2026-01-21', open: 31.67, high: 32.665, low: 30.97, close: 32.25},
  {date: '2026-01-22', open: 33.015, high: 33.47, low: 32.375, close: 32.47},
  {date: '2026-01-23', open: 33.48, high: 33.63, low: 31.33, close: 31.69},
  {date: '2026-01-26', open: 31.42, high: 31.53, low: 30.67, close: 30.785},
  {date: '2026-01-27', open: 30.83, high: 31.285, low: 29.93, close: 31.19},
  {date: '2026-01-28', open: 31.59, high: 32.33, low: 30.98, close: 31.19},
  {date: '2026-01-29', open: 30.72, high: 30.73, low: 29.145, close: 30.13},
  {date: '2026-01-30', open: 30.15, high: 30.36, low: 28.9, close: 29.13},
  {date: '2026-02-02', open: 28.99, high: 30.96, low: 28.835, close: 29.72},
  {date: '2026-02-03', open: 29.985, high: 30.17, low: 28.665, close: 29.765},
  {date: '2026-02-04', open: 32.75, high: 34.93, low: 31.76, close: 33.75},
  {date: '2026-02-05', open: 33.01, high: 33.455, low: 29.38, close: 30.85},
  {date: '2026-02-06', open: 31.835, high: 34.7, low: 31.22, close: 34.345},
  {date: '2026-02-09', open: 33.21, high: 33.9, low: 32.66, close: 33.54},
  {date: '2026-02-10', open: 33.83, high: 34.38, low: 33.02, close: 33.33},
  {date: '2026-02-11', open: 33.745, high: 33.83, low: 31.64, close: 32.05},
  {date: '2026-02-12', open: 32.14, high: 32.3, low: 30.42, close: 30.44},
  {date: '2026-02-13', open: 30.63, high: 31.22, low: 30.27, close: 30.53},
  {date: '2026-02-17', open: 30.305, high: 30.73, low: 29.59, close: 30.12},
  {date: '2026-02-18', open: 30.025, high: 30.41, low: 29.36, close: 29.71},
  {date: '2026-02-19', open: 31.18, high: 32.19, low: 31, close: 32.17},
  {date: '2026-02-20', open: 31.49, high: 32.91, low: 31.49, close: 32.4},
  {date: '2026-02-23', open: 31.77, high: 32.08, low: 30.57, close: 30.73},
  {date: '2026-02-24', open: 31.025, high: 31.365, low: 30.29, close: 31.14},
  {date: '2026-02-25', open: 31.6, high: 33.855, low: 31.6, close: 33.58},
  {date: '2026-02-26', open: 33.27, high: 33.44, low: 31.165, close: 32.3},
  {date: '2026-02-27', open: 31.89, high: 33.03, low: 31.395, close: 32.39},
  {date: '2026-03-02', open: 30.9, high: 31.97, low: 30.55, close: 31.84},
  {date: '2026-03-03', open: 30.875, high: 31.325, low: 29.695, close: 30.67},
  {date: '2026-03-04', open: 30.96, high: 32.955, low: 30.87, close: 32.63},
  {date: '2026-03-05', open: 32.315, high: 33.5, low: 31.485, close: 32.25},
  {date: '2026-03-06', open: 31.46, high: 32.41, low: 31.12, close: 31.31},
  {date: '2026-03-09', open: 30.74, high: 32.15, low: 29.87, close: 31.985},
  {date: '2026-03-10', open: 31.84, high: 32.36, low: 31.57, close: 31.79},
  {date: '2026-03-11', open: 32.52, high: 33.06, low: 31.555, close: 31.79},
  {date: '2026-03-12', open: 31.63, high: 31.8, low: 30.8, close: 30.91},
  {date: '2026-03-13', open: 30.975, high: 31.22, low: 30.235, close: 30.77},
  {date: '2026-03-16', open: 31.465, high: 32.43, low: 30.92, close: 31.85},
  {date: '2026-03-17', open: 31.955, high: 32.8, low: 31.48, close: 31.51},
  {date: '2026-03-18', open: 31.335, high: 31.675, low: 30.325, close: 30.35},
  {date: '2026-03-19', open: 30.01, high: 30.83, low: 29.8, close: 30.8},
  {date: '2026-03-20', open: 22.52, high: 23.095, low: 20.355, close: 20.56},
  {date: '2026-03-23', open: 20.295, high: 22.12, low: 19.48, close: 21.58},
  {date: '2026-03-24', open: 21.265, high: 22.56, low: 20.995, close: 22.26},
  {date: '2026-03-25', open: 22.63, high: 24.19, low: 22.58, close: 24.08},
  {date: '2026-03-26', open: 23.32, high: 23.735, low: 21.87, close: 22.22},
  {date: '2026-03-27', open: 22.19, high: 22.36, low: 21.385, close: 21.93},
  {date: '2026-03-30', open: 22.14, high: 22.25, low: 20.71, close: 21.04},
  {date: '2026-03-31', open: 21.39, high: 22.795, low: 21.36, close: 22.76},
  {date: '2026-04-01', open: 22.87, high: 23.355, low: 22.35, close: 22.52},
  {date: '2026-04-02', open: 21.96, high: 23.33, low: 21.89, close: 23.21},
  {date: '2026-04-06', open: 23.09, high: 23.43, low: 22.03, close: 22.07},
  {date: '2026-04-07', open: 22, high: 22.69, low: 21.79, close: 22.67},
  {date: '2026-04-08', open: 23.995, high: 24.17, low: 22.87, close: 23.36},
  {date: '2026-04-09', open: 23.49, high: 23.91, low: 23.095, close: 23.21},
  {date: '2026-04-10', open: 23.655, high: 25.525, low: 23.655, close: 25.25},
  {date: '2026-04-13', open: 25.07, high: 25.99, low: 24.46, close: 25.98},
  {date: '2026-04-14', open: 27.07, high: 27.79, low: 26.51, close: 27.2},
  {date: '2026-04-15', open: 27.73, high: 27.89, low: 26.95, close: 27.3},
  {date: '2026-04-16', open: 27.65, high: 28.71, low: 26.69, close: 28.39},
  {date: '2026-04-17', open: 29.03, high: 29.12, low: 28.18, close: 28.56},
];

const STARTING_CASH = 10_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toExchangeCandles(dataset: readonly DailyBar[], base: string): ExchangeCandle[] {
  const sessionStartMillis = new Date(`${dataset[0]!.date}T14:30:00.000Z`).getTime();

  return dataset.map((bar, i) => {
    const openTimeInMillis = sessionStartMillis + i * ONE_DAY_MS;

    return {
      base,
      close: bar.close.toString(),
      counter: 'USD',
      high: bar.high.toString(),
      low: bar.low.toString(),
      open: bar.open.toString(),
      openTimeInISO: new Date(openTimeInMillis).toISOString(),
      openTimeInMillis,
      sizeInMillis: 60_000,
      volume: '100000',
    };
  });
}

function createMockExchange(base: string) {
  const balances = new Map([
    [base, {available: new Big(0), hold: new Big(0)}],
    ['USD', {available: new Big(STARTING_CASH), hold: new Big(0)}],
  ]);

  return new AlpacaExchangeMock({balances});
}

async function runBacktest(dataset: readonly DailyBar[], base: string): Promise<BacktestResult> {
  const strategy = new TrailingHigherLowStrategy({entry: 'immediate', lookback: 1});
  const config: BacktestConfig = {
    candles: toExchangeCandles(dataset, base),
    exchange: createMockExchange(base),
    strategy,
    tradingPair: new TradingPair(base, 'USD'),
  };

  return new BacktestExecutor(config).execute();
}

function strategyEquityCurve(dataset: readonly DailyBar[], base: string, trades: readonly BacktestTrade[]): number[] {
  const candles = toExchangeCandles(dataset, base);
  const tradesByISO = new Map<string, BacktestTrade[]>();

  for (const trade of trades) {
    const list = tradesByISO.get(trade.openTimeInISO) ?? [];
    list.push(trade);
    tradesByISO.set(trade.openTimeInISO, list);
  }

  let cash = STARTING_CASH;
  let shares = 0;
  const curve: number[] = [];

  candles.forEach((candle, i) => {
    for (const trade of tradesByISO.get(candle.openTimeInISO) ?? []) {
      const notional = trade.price.mul(trade.size).toNumber();
      const fee = trade.fee.toNumber();

      if (trade.side === ExchangeOrderSide.BUY) {
        cash = cash - notional - fee;
        shares = shares + trade.size.toNumber();
      } else {
        cash = cash + notional - fee;
        shares = shares - trade.size.toNumber();
      }
    }

    curve.push(cash + shares * dataset[i]!.close);
  });

  return curve;
}

function buyHoldEquityCurve(dataset: readonly DailyBar[]): number[] {
  // Match the strategy: advice fires on bar 0 (i=0), fill on bar 1 (i=1) at open, then hold.
  const entryPrice = dataset[1]!.open;
  const shares = STARTING_CASH / entryPrice;

  return dataset.map((bar, i) => (i === 0 ? STARTING_CASH : shares * bar.close));
}

function maxDrawdown(curve: readonly number[]): number {
  let peak = curve[0]!;
  let maxDD = 0;

  for (const equity of curve) {
    if (equity > peak) {
      peak = equity;
    }

    const drawdown = (peak - equity) / peak;

    if (drawdown > maxDD) {
      maxDD = drawdown;
    }
  }

  return maxDD;
}

describe('TrailingHigherLowStrategy', () => {
  describe('drawdown vs buy-and-hold', () => {
    it('has a smaller max drawdown than buy-and-hold on AMD (trending regime)', async () => {
      const result = await runBacktest(AMD_DAILY, 'AMD');
      const strategyDD = maxDrawdown(strategyEquityCurve(AMD_DAILY, 'AMD', result.trades));
      const buyHoldDD = maxDrawdown(buyHoldEquityCurve(AMD_DAILY));

      expect(strategyDD).toBeLessThan(buyHoldDD);
    });

    it('has a smaller max drawdown than buy-and-hold on SMCI (falling-knife regime)', async () => {
      const result = await runBacktest(SMCI_DAILY, 'SMCI');
      const strategyDD = maxDrawdown(strategyEquityCurve(SMCI_DAILY, 'SMCI', result.trades));
      const buyHoldDD = maxDrawdown(buyHoldEquityCurve(SMCI_DAILY));

      expect(strategyDD).toBeLessThan(buyHoldDD);
    });
  });

  describe('default entry rule', () => {
    it('defaults to the "immediate" mode when entry is unspecified', async () => {
      const strategy = new TrailingHigherLowStrategy({});
      const config: BacktestConfig = {
        candles: toExchangeCandles(AMD_DAILY, 'AMD'),
        exchange: createMockExchange('AMD'),
        strategy,
        tradingPair: new TradingPair('AMD', 'USD'),
      };

      const result = await new BacktestExecutor(config).execute();
      const firstBuy = result.trades.find(trade => trade.side === ExchangeOrderSide.BUY);

      // Immediate mode: the first buy fills on candle #2 using candle #1's market advice,
      // at roughly candle #2's open ($235.99).
      expect(firstBuy).toBeDefined();
      expect(firstBuy!.price.toNumber()).toBeCloseTo(235.99, 1);
    });
  });
});
