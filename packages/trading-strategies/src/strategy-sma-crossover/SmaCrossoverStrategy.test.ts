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

  /*
   * Different timeframes: fast SMA2 on 1m bars vs slow SMA2 on 2m bars.
   * The 2m batcher emits on candle indices 1, 3, 5, 7, 9, so the slow SMA is stable from
   * index 3 onward. Fast crosses above slow at index 6 (BUY) and back below at index 9 (SELL).
   */
  const dualTimeframePrices = [10, 10, 10, 8, 8, 6, 14, 20, 8, 4];

  describe('config', () => {
    it('applies defaults when constructed without a config', () => {
      const strategy = new SmaCrossoverStrategy();
      expect(strategy.isWarmedUp).toBe(false);
    });

    it('rejects a fast and slow SMA that are configured identically', () => {
      expect(
        () => new SmaCrossoverStrategy({fastPeriod: 10, fastTimeframe: '5m', slowPeriod: 10, slowTimeframe: '5m'})
      ).toThrowError(/never cross/);
    });

    it('allows the same timeframe as long as the periods differ', () => {
      expect(
        () => new SmaCrossoverStrategy({fastPeriod: 2, fastTimeframe: '1m', slowPeriod: 3, slowTimeframe: '1m'})
      ).not.toThrow();
    });

    it('rejects a timeframe below one minute', () => {
      expect(() => new SmaCrossoverStrategy({fastTimeframe: '30s'})).toThrowError();
      expect(() => new SmaCrossoverStrategy({slowTimeframe: '30s'})).toThrowError();
    });

    it('accepts ms-syntax timeframes like "5m" and "1d"', () => {
      expect(() => new SmaCrossoverStrategy({fastTimeframe: '5m', slowTimeframe: '1d'})).not.toThrow();
    });
  });

  describe('processCandle (shared timeframe)', () => {
    const config = {fastPeriod: 2, fastTimeframe: '1m', slowPeriod: 3, slowTimeframe: '1m'} as const;

    it('stays silent until both SMAs are warmed up', async () => {
      const strategy = new SmaCrossoverStrategy(config);
      const advices = await feed(strategy, [10, 11]); // only 2 bars: slow SMA3 not stable yet
      expect(advices).toHaveLength(0);
      expect(strategy.isWarmedUp).toBe(false);
    });

    it('buys when the fast SMA crosses above the slow SMA', async () => {
      const strategy = new SmaCrossoverStrategy(config);
      const [buy] = await feed(strategy, crossoverPrices);
      assertMarket(buy, OrderSide.BUY);
      expect(buy.amountIn).toBe('counter');
      expect(buy.amount).toBe(AllAvailableAmount);
    });

    it('sells when the fast SMA crosses back below the slow SMA', async () => {
      const strategy = new SmaCrossoverStrategy(config);
      const [, sell] = await feed(strategy, crossoverPrices);
      assertMarket(sell, OrderSide.SELL);
      expect(sell.amountIn).toBe('base');
      expect(sell.amount).toBe(AllAvailableAmount);
    });

    it('fires exactly one BUY then one SELL across a single up-and-down swing', async () => {
      const strategy = new SmaCrossoverStrategy(config);
      const advices = await feed(strategy, crossoverPrices);
      expect(advices.map(advice => advice.side)).toEqual([OrderSide.BUY, OrderSide.SELL]);
    });
  });

  describe('processCandle (different timeframes)', () => {
    const config = {fastPeriod: 2, fastTimeframe: '1m', slowPeriod: 2, slowTimeframe: '2m'} as const;

    it('crosses a 1m fast SMA against a 2m slow SMA (one BUY then one SELL)', async () => {
      const strategy = new SmaCrossoverStrategy(config);
      const advices = await feed(strategy, dualTimeframePrices);
      expect(advices.map(advice => advice.side)).toEqual([OrderSide.BUY, OrderSide.SELL]);
      const [buy, sell] = advices;
      assertMarket(buy, OrderSide.BUY);
      assertMarket(sell, OrderSide.SELL);
    });

    it('waits for the slower SMA before it can produce advice', async () => {
      const strategy = new SmaCrossoverStrategy(config);
      // Two 1m candles warm up the fast SMA but only complete one 2m bar, so slow SMA2 is not stable.
      const advices = await feed(strategy, dualTimeframePrices.slice(0, 3));
      expect(advices).toHaveLength(0);
      expect(strategy.isWarmedUp).toBe(false);
    });
  });
});
