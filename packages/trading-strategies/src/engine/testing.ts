import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import Big from 'big.js';
import {z} from 'zod';
import {AlpacaBrokerMock, CandleBatcher, CandleSchema, ONE_MINUTE_IN_MS, TradingPair} from '@typedtrader/exchange';
import type {Candle, OneMinuteBatchedCandle} from '@typedtrader/exchange';
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

/**
 * How long a test gets when it replays {@link loadCandles}. Ten thousand candles through two
 * strategies is slower than Vitest allows by default, and slower again under coverage.
 */
export const WEEK_LONG_TIMEOUT = 30_000;

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

/**
 * One minute of price action in the shape a strategy receives it, for the few tests that drive
 * `onCandle` directly because they need to change the account between candles.
 */
export function batched(candle: Candle): OneMinuteBatchedCandle {
  const {sizeInMillis: _ignored, ...batchedCandle} = CandleBatcher.toBatchedCandle(candle);
  return {...batchedCandle, sizeInMillis: ONE_MINUTE_IN_MS};
}

/** One-minute candles that walk through the given prices in order. */
export function candlesAt(prices: string[], startAt = 0): Candle[] {
  return prices.flatMap((price, index) => flatCandles(1, price, startAt + index * ONE_MINUTE_IN_MS));
}

/**
 * `history` is what the strategy's own warm-up asks the broker for, which is separate from the
 * candles it is tested on: bars dated before the first of those, as a real exchange would serve.
 */
export function createBroker(balances: Balances, history: Candle[] = []) {
  return new AlpacaBrokerMock({
    balances: new Map([
      ['BTC', {available: new Big(balances.baseBalance), hold: new Big(0)}],
      ['USDT', {available: new Big(balances.counterBalance), hold: new Big(0)}],
    ]),
    marketData: {
      getCandles: async (_pair, {startTimeFirstCandle, startTimeLastCandle}) =>
        history.filter(
          candle =>
            candle.openTimeInMillis >= Date.parse(startTimeFirstCandle) &&
            candle.openTimeInMillis <= Date.parse(startTimeLastCandle)
        ),
    },
  });
}

export async function backtest(
  strategy: TradingSessionStrategy,
  candles: Candle[],
  balances: Balances,
  history: Candle[] = []
): Promise<BacktestResult> {
  const config: BacktestConfig = {broker: createBroker(balances, history), candles, strategy, tradingPair};
  return new BacktestExecutor(config).execute();
}

/** Daily bars walking through the given closes, the last of them closing before `endBefore`. */
export function dailyCandles(closes: string[], endBefore: number): Candle[] {
  const oneDayInMillis = 24 * 60 * ONE_MINUTE_IN_MS;

  return closes.map((close, index) => {
    const openTimeInMillis = endBefore - (closes.length - index) * oneDayInMillis;
    const price = parseFloat(close);
    return {
      base: 'BTC',
      close,
      counter: 'USDT',
      high: String(price + 1),
      low: String(price - 1),
      open: close,
      openTimeInISO: new Date(openTimeInMillis).toISOString(),
      openTimeInMillis,
      sizeInMillis: oneDayInMillis,
      volume: '1',
    };
  });
}

/**
 * The arguments a mock was called with, failing loudly when that call never happened. Reading
 * `mock.calls[0]` directly hands back a possibly-missing tuple, which a test then destructures
 * into values that silently read as `undefined`.
 */
export function callArgs<Args extends unknown[]>(mock: {mock: {calls: Args[]}}, index = 0): Args {
  const call = mock.mock.calls[index];
  if (!call) {
    throw new Error(`Expected call #${index + 1}, but the mock was called ${mock.mock.calls.length} time(s)`);
  }
  return call;
}

/** Trades reduced to what a trader would compare: direction, size and price, in order. */
export function tradeLog(result: BacktestResult): string[] {
  return result.trades.map(trade => `${trade.side} ${trade.size.toFixed()} @ ${trade.price.toFixed()}`);
}
