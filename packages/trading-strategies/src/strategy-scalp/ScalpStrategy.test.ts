import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {CandleBatcher, ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {ExchangeCandle, ExchangeFill, LimitOrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {TradingPair} from '@typedtrader/exchange';
import {ScalpStrategy, ScalpSchema} from './ScalpStrategy.js';

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

function makeCandle(close: number, index: number): ExchangeCandle {
  const closeStr = String(close);
  return {
    base: 'AAPL',
    close: closeStr,
    counter: 'USD',
    high: String(close + 1),
    low: String(close - 1),
    open: closeStr,
    openTimeInISO: new Date(1735689600000 + index * 60000).toISOString(),
    openTimeInMillis: 1735689600000 + index * 60000,
    sizeInMillis: 60000,
    volume: '1000',
  };
}

function toBatched(candle: ExchangeCandle) {
  return CandleBatcher.createOneMinuteBatchedCandle([candle]);
}

function makeFill(price: string, side: ExchangeOrderSide): ExchangeFill {
  return {
    created_at: '2025-01-01T00:00:00.000Z',
    fee: '0.01',
    feeAsset: 'USD',
    order_id: 'order-1',
    pair,
    position: 'LONG' as any,
    price,
    side,
    size: '10',
  };
}

describe('ScalpSchema', () => {
  it('accepts valid config', () => {
    expect(() => ScalpSchema.parse({offset: '0.10'})).not.toThrow();
  });

  it('accepts config with custom emaPeriod', () => {
    const config = ScalpSchema.parse({offset: '0.50', emaPeriod: 10});
    expect(config.emaPeriod).toBe(10);
  });

  it('defaults emaPeriod to 5', () => {
    const config = ScalpSchema.parse({offset: '0.10'});
    expect(config.emaPeriod).toBe(5);
  });

  it('rejects non-positive offset', () => {
    expect(() => ScalpSchema.parse({offset: '0'})).toThrow();
    expect(() => ScalpSchema.parse({offset: '-1'})).toThrow();
  });
});

describe('ScalpStrategy', () => {
  it('returns no advice during EMA warmup', async () => {
    const strategy = new ScalpStrategy({offset: '0.10', emaPeriod: 5});

    // Feed 4 candles (need 5 for EMA to stabilize)
    for (let i = 0; i < 4; i++) {
      const advice = await strategy.onCandle(toBatched(makeCandle(100 + i, i)), mockState);
      expect(advice).toBeUndefined();
    }
  });

  it('returns no advice when price is below EMA', async () => {
    const strategy = new ScalpStrategy({offset: '0.10', emaPeriod: 3});

    // Rising prices to warm up EMA, then a drop
    const prices = [100, 102, 104, 98] as const;

    let lastAdvice;

    for (let i = 0; i < prices.length; i++) {
      lastAdvice = await strategy.onCandle(toBatched(makeCandle(prices[i], i)), mockState);
    }

    // Price 98 is below EMA of rising series — no buy
    expect(lastAdvice).toBeUndefined();
  });

  it('enters with a market buy when price crosses above EMA', async () => {
    const strategy = new ScalpStrategy({offset: '0.10', emaPeriod: 3});

    // Steady rise so price stays above EMA
    const prices = [100, 101, 102, 103] as const;
    let buyAdvice;

    for (let i = 0; i < prices.length; i++) {
      const advice = await strategy.onCandle(toBatched(makeCandle(prices[i], i)), mockState);

      if (advice) {
        buyAdvice = advice;
        break;
      }
    }

    expect(buyAdvice).toBeDefined();
    expect(buyAdvice!.side).toBe(ExchangeOrderSide.BUY);
    expect(buyAdvice!.type).toBe(ExchangeOrderType.MARKET);
    expect(buyAdvice!.amountIn).toBe('counter');
  });

  it('places a limit sell at fill + offset after buy fills', async () => {
    const strategy = new ScalpStrategy({offset: '0.50', emaPeriod: 3});

    // Warm up and trigger entry
    const prices = [100, 101, 102, 103] as const;

    for (let i = 0; i < prices.length; i++) {
      const advice = await strategy.onCandle(toBatched(makeCandle(prices[i], i)), mockState);

      if (advice) {
        break;
      }
    }

    // Simulate fill at 103
    await strategy.onFill(makeFill('103', ExchangeOrderSide.BUY), mockState);

    // Next candle should produce a limit sell at 103 + 0.50 = 103.50
    const sellAdvice = await strategy.onCandle(toBatched(makeCandle(103, 10)), mockState);

    expect(sellAdvice).toBeDefined();
    expect(sellAdvice!.side).toBe(ExchangeOrderSide.SELL);
    expect(sellAdvice!.type).toBe(ExchangeOrderType.LIMIT);
    expect(new Big((sellAdvice as LimitOrderAdvice).price).toFixed(2)).toBe('103.50');
  });

  it('places a limit buy at fill - offset after sell fills', async () => {
    const strategy = new ScalpStrategy({offset: '0.50', emaPeriod: 3});

    // Warm up and trigger entry
    for (let i = 0; i < 4; i++) {
      const advice = await strategy.onCandle(toBatched(makeCandle(100 + i, i)), mockState);

      if (advice) {
        break;
      }
    }

    // Simulate buy fill, then sell fill
    await strategy.onFill(makeFill('103', ExchangeOrderSide.BUY), mockState);
    await strategy.onCandle(toBatched(makeCandle(103, 10)), mockState); // emit sell advice
    await strategy.onFill(makeFill('103.50', ExchangeOrderSide.SELL), mockState);

    // Next candle should produce a limit buy at 103.50 - 0.50 = 103.00
    const buyAdvice = await strategy.onCandle(toBatched(makeCandle(103, 11)), mockState);

    expect(buyAdvice).toBeDefined();
    expect(buyAdvice!.side).toBe(ExchangeOrderSide.BUY);
    expect(buyAdvice!.type).toBe(ExchangeOrderType.LIMIT);
    expect(new Big((buyAdvice as LimitOrderAdvice).price).toFixed(2)).toBe('103.00');
  });

  it('returns no advice while waiting for a fill', async () => {
    const strategy = new ScalpStrategy({offset: '0.50', emaPeriod: 3});

    // Trigger entry
    for (let i = 0; i < 4; i++) {
      await strategy.onCandle(toBatched(makeCandle(100 + i, i)), mockState);
    }

    // Simulate buy fill and emit sell advice
    await strategy.onFill(makeFill('103', ExchangeOrderSide.BUY), mockState);
    await strategy.onCandle(toBatched(makeCandle(103, 10)), mockState);

    // Subsequent candles should return no advice (waiting for sell to fill)
    const advice = await strategy.onCandle(toBatched(makeCandle(104, 11)), mockState);
    expect(advice).toBeUndefined();
  });

  it('includes a reason in the entry advice', async () => {
    const strategy = new ScalpStrategy({offset: '0.10', emaPeriod: 3});

    let entryAdvice;

    for (let i = 0; i < 4; i++) {
      const advice = await strategy.onCandle(toBatched(makeCandle(100 + i, i)), mockState);

      if (advice) {
        entryAdvice = advice;
        break;
      }
    }

    expect(entryAdvice!.reason).toContain('Entry');
    expect(entryAdvice!.reason).toContain('EMA');
  });

  it('pre-seeds EMA via init() to skip warmup', async () => {
    const strategy = new ScalpStrategy({offset: '0.10', emaPeriod: 3});

    // Pre-seed with 3 candles
    const historicalCandles = [makeCandle(100, 0), makeCandle(101, 1), makeCandle(102, 2)] as const;
    strategy.init(historicalCandles.map(toBatched));

    // First live candle with rising price should trigger entry immediately
    const advice = await strategy.onCandle(toBatched(makeCandle(103, 3)), mockState);

    expect(advice).toBeDefined();
    expect(advice!.side).toBe(ExchangeOrderSide.BUY);
    expect(advice!.type).toBe(ExchangeOrderType.MARKET);
  });

  it('restores state across restarts', async () => {
    const strategy = new ScalpStrategy({offset: '0.50', emaPeriod: 3});

    strategy.restoreState({
      lastFillPrice: '103',
      lastFillSide: ExchangeOrderSide.BUY,
      phase: 'pendingAdvice',
    });

    // Should immediately produce a sell advice on next candle
    const advice = await strategy.onCandle(toBatched(makeCandle(103, 0)), mockState);

    expect(advice).toBeDefined();
    expect(advice!.side).toBe(ExchangeOrderSide.SELL);
    expect(advice!.type).toBe(ExchangeOrderType.LIMIT);
    expect(new Big((advice as LimitOrderAdvice).price).toFixed(2)).toBe('103.50');
  });

  it('has the correct strategy name', () => {
    expect(ScalpStrategy.NAME).toBe('@typedtrader/strategy-scalp');
  });

  it('accepts config without offset', () => {
    expect(() => ScalpSchema.parse({})).not.toThrow();
    expect(() => ScalpSchema.parse({emaPeriod: 10})).not.toThrow();
  });

  it('auto-computes offset from init() candles when not configured', () => {
    const strategy = new ScalpStrategy({emaPeriod: 3});

    // Build 20 "trading days" worth of 1-min candles spread across different dates
    const candles: ExchangeCandle[] = [];
    const dayMs = 86_400_000;
    for (let day = 0; day < 20; day++) {
      for (let min = 0; min < 7; min++) {
        const base = 100 + (day % 5) * 3;
        const closeStr = String(base);
        const ts = 1735689600000 + day * dayMs + min * 60000;
        candles.push({
          base: 'AAPL',
          close: closeStr,
          counter: 'USD',
          high: String(base + 2),
          low: String(base - 2),
          open: closeStr,
          openTimeInISO: new Date(ts).toISOString(),
          openTimeInMillis: ts,
          sizeInMillis: 60000,
          volume: '1000',
        });
      }
    }

    // Should not throw — offset is auto-computed from the candles
    strategy.init(candles.map(toBatched));
  });
});
