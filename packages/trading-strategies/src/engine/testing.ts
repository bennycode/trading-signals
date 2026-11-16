import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import Big from 'big.js';
import {z} from 'zod';
import {AlpacaBrokerMock, CandleSchema, ONE_MINUTE_IN_MS, TradingPair} from '@typedtrader/exchange';
import type {Candle} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import type {BacktestConfig} from '../backtest/BacktestConfig.js';
import type {BacktestResult} from '../backtest/BacktestResult.js';
import type {TradingSessionStrategy} from '../trader/index.js';

export {ONE_MINUTE_IN_MS};

export const tradingPair = new TradingPair('BTC', 'USDT');

export interface Balances {
  baseBalance: string;
  counterBalance: string;
}

/** Holding a whole unit of the base asset, which is what a close rule needs to have anything to sell. */
export const holdingFromTheStart: Balances = {baseBalance: '1', counterBalance: '0'};

/** Flat with cash to spend, which is what an open rule needs. */
export const flatWithCash: Balances = {baseBalance: '0', counterBalance: '50000'};

/** A week of real one-minute candles, for comparing a ported strategy against the class it replaces. */
export function loadCandles(): Candle[] {
  const file = join(import.meta.dirname, '../backtest/candles/BNB_USDT_2021_02_19_1_week.json');
  return z.array(CandleSchema).parse(JSON.parse(readFileSync(file, 'utf8')));
}

/** A run of identical one-minute candles, so indicators warm up without the price moving. */
export function flatCandles(count: number, price: string, startAt = 0): Candle[] {
  return Array.from({length: count}, (_, index) => ({
    base: 'BTC',
    close: price,
    counter: 'USDT',
    high: price,
    low: price,
    open: price,
    openTimeInISO: new Date(startAt + index * ONE_MINUTE_IN_MS).toISOString(),
    openTimeInMillis: startAt + index * ONE_MINUTE_IN_MS,
    sizeInMillis: ONE_MINUTE_IN_MS,
    volume: '1',
  }));
}

/** One-minute candles that walk through the given prices in order. */
export function candlesAt(prices: string[], startAt = 0): Candle[] {
  return prices.flatMap((price, index) => flatCandles(1, price, startAt + index * ONE_MINUTE_IN_MS));
}

export function createBroker(balances: Balances) {
  return new AlpacaBrokerMock({
    balances: new Map([
      ['BTC', {available: new Big(balances.baseBalance), hold: new Big(0)}],
      ['USDT', {available: new Big(balances.counterBalance), hold: new Big(0)}],
    ]),
  });
}

export async function backtest(
  strategy: TradingSessionStrategy,
  candles: Candle[],
  balances: Balances
): Promise<BacktestResult> {
  const config: BacktestConfig = {broker: createBroker(balances), candles, strategy, tradingPair};
  return new BacktestExecutor(config).execute();
}

/** Trades reduced to what a trader would compare: direction, size and price, in order. */
export function tradeLog(result: BacktestResult): string[] {
  return result.trades.map(trade => `${trade.side} ${trade.size.toFixed()} @ ${trade.price.toFixed()}`);
}
