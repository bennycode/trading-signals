import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaBroker, AlpacaBrokerMock, TradingPair} from '@typedtrader/exchange';
import type {Candle, HistoricalCandleProvider} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {DynamicTrailStrategy} from './DynamicTrailStrategy.js';
import type {BacktestConfig} from '../backtest/BacktestConfig.js';

const DAY = 86_400_000;

function dailyCandle(index: number, close: number): Candle {
  const openTimeInMillis = Date.UTC(2026, 0, 1) + index * DAY;

  return {
    base: 'ACME',
    close: String(close),
    counter: 'USD',
    high: String(close + 2),
    low: String(close - 2),
    open: String(close),
    openTimeInISO: new Date(openTimeInMillis).toISOString(),
    openTimeInMillis,
    sizeInMillis: DAY,
    volume: '100',
  };
}

// Returns `count` daily candles with steady ~4-wide ranges, so ATR warms to a non-zero value.
const warmProvider: HistoricalCandleProvider = {
  getRecentCandles: (_intervalInMillis, count) =>
    Promise.resolve(Array.from({length: count}, (_unused, index) => dailyCandle(index, 100 + (index % 3)))),
};

function acmeExchange() {
  const balances = new Map([
    ['ACME', {available: new Big('5'), hold: new Big(0)}],
    ['USD', {available: new Big(0), hold: new Big(0)}],
  ]);
  return new AlpacaBrokerMock({balances, tradingRules: AlpacaBroker.DEFAULT_CRYPTO_TRADING_RULES});
}

describe('DynamicTrailStrategy daily-ATR warm-up', () => {
  const tradingPair = new TradingPair('ACME', 'USD');
  const liveCandles = [dailyCandle(40, 110), dailyCandle(41, 109)];

  it('sizes the stop on the first live candle when init() pre-seeds the daily ATR', async () => {
    const strategy = new DynamicTrailStrategy({atrInterval: 14, atrIntervalMillis: DAY, atrMultiple: '3'});
    await strategy.init(warmProvider);

    const config: BacktestConfig = {broker: acmeExchange(), candles: liveCandles, strategy, tradingPair};
    await new BacktestExecutor(config).execute();

    expect(new Big(strategy.trailState.stopPrice).gt(0)).toBe(true);
  });

  it('without init(), the daily-aggregated ATR is still cold, so no stop is established yet', async () => {
    const strategy = new DynamicTrailStrategy({atrInterval: 14, atrIntervalMillis: DAY, atrMultiple: '3'});

    const config: BacktestConfig = {broker: acmeExchange(), candles: liveCandles, strategy, tradingPair};
    await new BacktestExecutor(config).execute();

    expect(strategy.trailState.stopPrice).toBe('0');
  });
});
