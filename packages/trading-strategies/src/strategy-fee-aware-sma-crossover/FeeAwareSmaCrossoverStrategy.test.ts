import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {CandleBatcher, OrderPosition, OrderSide, OrderType, TradingPair} from '@typedtrader/exchange';
import type {Candle, Fill, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {OrderAdvice, TradingSessionState, TradingSessionStrategy} from '../trader/index.js';
import {SmaCrossoverStrategy} from '../strategy-sma-crossover/SmaCrossoverStrategy.js';
import {FeeAwareSmaCrossoverStrategy} from './FeeAwareSmaCrossoverStrategy.js';

const pair = new TradingPair('AAPL', 'USD');
const ONE_MINUTE_IN_MS = 60_000;
const FEE_RATE = '0.002'; // 0.2% taker on both legs

function makeState(baseBalance: Big, counterBalance: Big): TradingSessionState {
  return {
    baseBalance,
    counterBalance,
    feeRates: {[OrderType.LIMIT]: new Big(FEE_RATE), [OrderType.MARKET]: new Big(FEE_RATE)},
    tradingRules: {
      base_increment: '0.0001',
      base_max_size: '100000',
      base_min_size: '0.0001',
      counter_increment: '0.01',
      counter_min_size: '1',
      pair,
    },
  };
}

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

function makeFill(price: number, size: Big, side: OrderSide): Fill {
  return {
    created_at: '2025-01-01T00:00:00.000Z',
    fee: '0',
    feeAsset: 'USD',
    order_id: 'order-1',
    pair,
    position: OrderPosition.LONG,
    price: String(price),
    side,
    size: size.toFixed(8),
  };
}

/**
 * Drives a strategy through a price series, simulating an all-in / all-out fill at each
 * candle's close whenever advice comes back — mirroring how the runtime would fill a
 * market order and then notify the strategy via `onFill`. Returns the order sides emitted.
 */
async function feedWithFills(strategy: TradingSessionStrategy, prices: number[]): Promise<OrderSide[]> {
  const sides: OrderSide[] = [];
  let base = new Big(0);
  let counter = new Big(1000);
  const feeRate = new Big(FEE_RATE);

  for (const [index, price] of prices.entries()) {
    const state = makeState(base, counter);
    const advice: OrderAdvice | void = await strategy.onCandle(makeCandle(price, index), state);
    if (!advice) {
      continue;
    }
    sides.push(advice.side);

    const p = new Big(price);
    if (advice.side === OrderSide.BUY) {
      const qty = counter.div(p.mul(new Big(1).plus(feeRate)));
      base = base.plus(qty);
      counter = new Big(0);
      await strategy.onFill?.(makeFill(price, qty, OrderSide.BUY), makeState(base, counter));
    } else {
      const qty = base;
      counter = counter.plus(qty.mul(p).mul(new Big(1).minus(feeRate)));
      base = new Big(0);
      await strategy.onFill?.(makeFill(price, qty, OrderSide.SELL), makeState(base, counter));
    }
  }

  return sides;
}

describe('FeeAwareSmaCrossoverStrategy', () => {
  const config = {fastPeriod: 2, fastTimeframe: '1m', slowPeriod: 3, slowTimeframe: '1m'} as const;

  /*
   * Baseline SMA crossover buys at ~9 and its bearish cross also lands at ~9: a wash on
   * price, a net loss after fees.
   */
  const losingRoundTrip = [10, 9, 8, 7, 6, 7, 9, 12, 15, 12, 9, 6];

  // Buys at ~9, then the bearish cross lands at ~22 — comfortably profitable after fees.
  const winningRoundTrip = [10, 9, 8, 7, 6, 9, 13, 18, 24, 30, 26, 22];

  it('the plain SMA crossover sells even when the round trip loses money', async () => {
    const sides = await feedWithFills(new SmaCrossoverStrategy(config), losingRoundTrip);
    expect(sides).toEqual([OrderSide.BUY, OrderSide.SELL]);
  });

  it('the fee-aware variant holds instead of selling that losing round trip', async () => {
    const sides = await feedWithFills(new FeeAwareSmaCrossoverStrategy(config), losingRoundTrip);
    expect(sides).toEqual([OrderSide.BUY]); // the loss-making SELL is suppressed
  });

  it('still sells when the round trip is profitable after fees', async () => {
    const sides = await feedWithFills(new FeeAwareSmaCrossoverStrategy(config), winningRoundTrip);
    expect(sides).toEqual([OrderSide.BUY, OrderSide.SELL]);
  });

  it('does not gate the buy — entries behave exactly like the base strategy', async () => {
    const plain = await feedWithFills(new SmaCrossoverStrategy(config), winningRoundTrip);
    const feeAware = await feedWithFills(new FeeAwareSmaCrossoverStrategy(config), winningRoundTrip);
    expect(feeAware[0]).toBe(OrderSide.BUY);
    expect(feeAware).toEqual(plain);
  });

  it('inherits the base config validation', () => {
    expect(
      () => new FeeAwareSmaCrossoverStrategy({fastPeriod: 5, fastTimeframe: '1m', slowPeriod: 5, slowTimeframe: '1m'})
    ).toThrowError(/never cross/);
  });
});
