import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {
  CandleBatcher,
  ExchangeOrderPosition,
  ExchangeOrderSide,
  ExchangeOrderType,
  TradingPair,
} from '@typedtrader/exchange';
import type {
  ExchangeCandle,
  ExchangeFill,
  LimitOrderAdvice,
  MarketOrderAdvice,
  OneMinuteBatchedCandle,
  OrderAdvice,
  TradingSessionState,
} from '@typedtrader/exchange';
import {BuyOnceStrategy} from '../strategy-buy-once/BuyOnceStrategy.js';

function assertMarketBuy(advice: OrderAdvice | void): asserts advice is MarketOrderAdvice {
  if (!advice || advice.type !== ExchangeOrderType.MARKET || advice.side !== ExchangeOrderSide.BUY) {
    throw new Error(`Expected a MARKET BUY advice but received ${JSON.stringify(advice)}`);
  }
}

function assertLimitSell(advice: OrderAdvice | void): asserts advice is LimitOrderAdvice {
  if (!advice || advice.type !== ExchangeOrderType.LIMIT || advice.side !== ExchangeOrderSide.SELL) {
    throw new Error(`Expected a LIMIT SELL advice but received ${JSON.stringify(advice)}`);
  }
}

const pair = new TradingPair('AAPL', 'USD');

const mockState: TradingSessionState = {
  baseBalance: new Big(0),
  counterBalance: new Big(1000),
  tradingRules: {
    base_increment: '0.01',
    base_max_size: '10000',
    base_min_size: '0.01',
    counter_increment: '0.01',
    counter_min_size: '1',
    pair,
  },
  feeRates: {
    [ExchangeOrderType.LIMIT]: new Big('0.001'),
    [ExchangeOrderType.MARKET]: new Big('0.002'),
  },
};

const ONE_MINUTE_IN_MS = 60_000;

function makeCandle(close: number, index = 0): OneMinuteBatchedCandle {
  const closeStr = String(close);
  const exchangeCandle: ExchangeCandle = {
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

function makeFill(price: string, size: string, side: ExchangeOrderSide): ExchangeFill {
  return {
    created_at: '2025-01-01T00:00:00.000Z',
    fee: '0',
    feeAsset: 'USD',
    order_id: 'order-1',
    pair,
    position: ExchangeOrderPosition.LONG,
    price,
    side,
    size,
  };
}

describe('BuyOnceStrategy (buy-and-hold mode, no buyAt)', () => {
  describe('unprotected', () => {
    it('issues a market buy on the first candle and then stays silent', async () => {
      const strategy = new BuyOnceStrategy();

      const first = await strategy.onCandle(makeCandle(100), mockState);
      assertMarketBuy(first);
      expect(first.amountIn).toBe('counter');

      const second = await strategy.onCandle(makeCandle(105, 1), mockState);
      expect(second).toBeUndefined();

      const third = await strategy.onCandle(makeCandle(50, 2), mockState);
      expect(third).toBeUndefined();
    });
  });

  describe('with stop-loss', () => {
    it('buys first, then fires a kill-switch limit sell when the stop-loss threshold is hit', async () => {
      const strategy = new BuyOnceStrategy({protected: {stopLossPct: '5'}});

      const buy = await strategy.onCandle(makeCandle(100), mockState);
      assertMarketBuy(buy);

      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const hold = await strategy.onCandle(makeCandle(97, 1), mockState);
      expect(hold).toBeUndefined();

      const exit = await strategy.onCandle(makeCandle(95, 2), mockState);
      assertLimitSell(exit);
      expect(new Big(exit.price).toFixed(2)).toBe('95.00');
      expect(exit.reason).toContain('[KILL SWITCH]');
      expect(exit.reason).toContain('Stop-loss');
    });
  });

  describe('with take-profit', () => {
    it('buys first, then fires a kill-switch limit sell when the take-profit threshold is hit', async () => {
      const strategy = new BuyOnceStrategy({protected: {takeProfitPct: '10'}});

      const buy = await strategy.onCandle(makeCandle(100), mockState);
      assertMarketBuy(buy);
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const hold = await strategy.onCandle(makeCandle(105, 1), mockState);
      expect(hold).toBeUndefined();

      const exit = await strategy.onCandle(makeCandle(110, 2), mockState);
      assertLimitSell(exit);
      expect(new Big(exit.price).toFixed(2)).toBe('110.00');
      expect(exit.reason).toContain('Take-profit');
    });
  });

  describe('with both guards', () => {
    it('does not re-enter after a stop-loss exit — buy-once is a one-shot entry', async () => {
      const strategy = new BuyOnceStrategy({protected: {stopLossPct: '5', takeProfitPct: '10'}});

      await strategy.onCandle(makeCandle(100), mockState);
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const exit = await strategy.onCandle(makeCandle(95, 1), mockState);
      assertLimitSell(exit);

      await strategy.onFill(makeFill('95', '10', ExchangeOrderSide.SELL), mockState);

      const silent = await strategy.onCandle(makeCandle(120, 2), mockState);
      expect(silent).toBeUndefined();
    });
  });

  describe('state persistence', () => {
    it('restores the bought flag and protected position through restoreState', async () => {
      const original = new BuyOnceStrategy({protected: {stopLossPct: '5'}});
      await original.onCandle(makeCandle(100), mockState);
      await original.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const snapshot = original.state;
      expect(snapshot).not.toBeNull();

      const restored = new BuyOnceStrategy({protected: {stopLossPct: '5'}});
      restored.restoreState(snapshot!);

      const shouldHold = await restored.onCandle(makeCandle(98, 1), mockState);
      expect(shouldHold).toBeUndefined();

      const exit = await restored.onCandle(makeCandle(95, 2), mockState);
      assertLimitSell(exit);
      expect(new Big(exit.price).toFixed(2)).toBe('95.00');
    });
  });
});
