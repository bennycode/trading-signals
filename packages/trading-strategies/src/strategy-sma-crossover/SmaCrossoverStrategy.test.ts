import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {CandleBatcher, OrderSide, OrderType, TradingPair} from '@typedtrader/exchange';
import type {Candle, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {MarketOrderAdvice, OrderAdvice, TradingSessionState} from '../trader/index.js';
import {AllAvailableAmount} from '../trader/index.js';
import {SmaCrossoverStrategy} from './SmaCrossoverStrategy.js';

const pair = new TradingPair('AAPL', 'USD');

const mockState: TradingSessionState = {
  baseBalance: new Big(0),
  counterBalance: new Big(1000),
  feeRates: {
    [OrderType.LIMIT]: new Big('0.001'),
    [OrderType.MARKET]: new Big('0.002'),
  },
  tradingRules: {
    base_increment: '0.01',
    base_max_size: '10000',
    base_min_size: '0.01',
    counter_increment: '0.01',
    counter_min_size: '1',
    pair,
  },
};

const ONE_MINUTE_IN_MS = 60_000;

function makeCandle(close: number, index: number): OneMinuteBatchedCandle {
  const closeStr = String(close);
  const exchangeCandle: Candle = {
    base: 'AAPL',
    close: closeStr,
    counter: 'USD',
    high: String(close + 1),
    low: String(close - 1),
    open: closeStr,
    openTimeInISO: new Date(1735689600000 + index * ONE_MINUTE_IN_MS).toISOString(),
    openTimeInMillis: 1735689600000 + index * ONE_MINUTE_IN_MS,
    sizeInMillis: ONE_MINUTE_IN_MS,
    volume: '1000',
  };
  return CandleBatcher.createOneMinuteBatchedCandle([exchangeCandle]);
}

async function feed(strategy: SmaCrossoverStrategy, prices: number[]): Promise<OrderAdvice[]> {
  const advices: OrderAdvice[] = [];
  for (const [index, price] of prices.entries()) {
    const advice = await strategy.onCandle(makeCandle(price, index), mockState);
    if (advice) {
      advices.push(advice);
    }
  }
  return advices;
}

function assertMarket(advice: OrderAdvice, side: OrderSide): asserts advice is MarketOrderAdvice {
  if (advice.type !== OrderType.MARKET || advice.side !== side) {
    throw new Error(`Expected a MARKET ${side} advice but received ${JSON.stringify(advice)}`);
  }
}

describe('SmaCrossoverStrategy', () => {
  // Falls first (fast SMA below slow), then rallies (cross up → BUY), then drops (cross down → SELL).
  const crossoverPrices = [10, 9, 8, 7, 6, 7, 9, 12, 15, 12, 9, 6];

  describe('config', () => {
    it('applies defaults when constructed without a config', () => {
      const strategy = new SmaCrossoverStrategy();
      expect(strategy.isWarmedUp).toBe(false);
    });

    it('rejects a shortPeriod that is not smaller than longPeriod', () => {
      expect(() => new SmaCrossoverStrategy({longPeriod: 20, shortPeriod: 20})).toThrowError(/must be smaller/);
      expect(() => new SmaCrossoverStrategy({longPeriod: 20, shortPeriod: 30})).toThrowError(/must be smaller/);
    });

    it('rejects a timeframe below one minute', () => {
      expect(() => new SmaCrossoverStrategy({timeframe: '30s'})).toThrowError();
    });

    it('accepts ms-syntax timeframes like "5m" and "1d"', () => {
      expect(() => new SmaCrossoverStrategy({timeframe: '5m'})).not.toThrow();
      expect(() => new SmaCrossoverStrategy({timeframe: '1d'})).not.toThrow();
    });
  });

  describe('processCandle', () => {
    it('stays silent until both SMAs are warmed up', async () => {
      const strategy = new SmaCrossoverStrategy({longPeriod: 3, shortPeriod: 2, timeframe: '1m'});
      const advices = await feed(strategy, [10, 11]); // only 2 bars: SMA3 not stable yet
      expect(advices).toHaveLength(0);
      expect(strategy.isWarmedUp).toBe(false);
    });

    it('buys when the fast SMA crosses above the slow SMA', async () => {
      const strategy = new SmaCrossoverStrategy({longPeriod: 3, shortPeriod: 2, timeframe: '1m'});
      const [buy] = await feed(strategy, crossoverPrices);
      assertMarket(buy, OrderSide.BUY);
      expect(buy.amountIn).toBe('counter');
      expect(buy.amount).toBe(AllAvailableAmount);
    });

    it('sells when the fast SMA crosses back below the slow SMA', async () => {
      const strategy = new SmaCrossoverStrategy({longPeriod: 3, shortPeriod: 2, timeframe: '1m'});
      const [, sell] = await feed(strategy, crossoverPrices);
      assertMarket(sell, OrderSide.SELL);
      expect(sell.amountIn).toBe('base');
      expect(sell.amount).toBe(AllAvailableAmount);
    });

    it('fires exactly one BUY then one SELL across a single up-and-down swing', async () => {
      const strategy = new SmaCrossoverStrategy({longPeriod: 3, shortPeriod: 2, timeframe: '1m'});
      const advices = await feed(strategy, crossoverPrices);
      expect(advices.map(advice => advice.side)).toEqual([OrderSide.BUY, OrderSide.SELL]);
    });
  });
});
