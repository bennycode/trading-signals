import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {OrderPosition, OrderSide, OrderType, TradingPair} from '@typedtrader/exchange';
import type {Fill, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {OrderAdvice, TradingSessionState} from '../trader/index.js';
import {Strategy} from './Strategy.js';

const pair = new TradingPair('AAPL', 'USD');

const mockState: TradingSessionState = {
  baseBalance: new Big(0),
  counterBalance: new Big(1000),
  feeRates: {[OrderType.LIMIT]: new Big('0.001'), [OrderType.MARKET]: new Big('0.002')},
  tradingRules: {
    base_increment: '0.0001',
    base_max_size: '100000',
    base_min_size: '0.0001',
    counter_increment: '0.01',
    counter_min_size: '1',
    pair,
  },
};

function makeFill(price: string, size: string, side: OrderSide): Fill {
  return {
    created_at: '2025-01-01T00:00:00.000Z',
    fee: '0',
    feeAsset: 'USD',
    order_id: 'order-1',
    pair,
    position: OrderPosition.LONG,
    price,
    side,
    size,
  };
}

/** Minimal concrete strategy that never trades — exercises only the base position tracking. */
class TestStrategy extends Strategy {
  static override NAME = 'test-strategy';

  protected override async processCandle(
    _candle: OneMinuteBatchedCandle,
    _state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    // Never trades; only the inherited fill tracking is under test.
  }
}

/** Overrides the fill hook to prove the base still tracks prices without any `super` call. */
class FillHookStrategy extends TestStrategy {
  fillCount = 0;

  protected override async processFill(): Promise<void> {
    this.fillCount++;
  }
}

/** Overrides the restore hook to prove the base stores state without a `super.restoreState()` call. */
class RestoreHookStrategy extends TestStrategy {
  hydrated: Record<string, unknown> | undefined = undefined;

  protected override hydrateState(persisted: Record<string, unknown>): void {
    this.hydrated = persisted;
  }
}

describe('Strategy fill tracking', () => {
  it('starts with no recorded fills', () => {
    const strategy = new TestStrategy();
    expect(strategy.lastBuyPrice).toBeUndefined();
    expect(strategy.lastSellPrice).toBeUndefined();
  });

  it('records the most recent buy price', async () => {
    const strategy = new TestStrategy();
    await strategy.onFill(makeFill('100', '1', OrderSide.BUY), mockState);
    await strategy.onFill(makeFill('120', '1', OrderSide.BUY), mockState);
    expect(strategy.lastBuyPrice?.toNumber()).toBe(120); // latest buy wins
    expect(strategy.lastSellPrice).toBeUndefined();
  });

  it('records the most recent sell price without clearing the last buy', async () => {
    const strategy = new TestStrategy();
    await strategy.onFill(makeFill('100', '1', OrderSide.BUY), mockState);
    await strategy.onFill(makeFill('130', '1', OrderSide.SELL), mockState);
    expect(strategy.lastBuyPrice?.toNumber()).toBe(100);
    expect(strategy.lastSellPrice?.toNumber()).toBe(130);
  });

  it('persists the last fills under the strategy state so the runtime can save it', async () => {
    const strategy = new TestStrategy();
    await strategy.onFill(makeFill('100', '1', OrderSide.BUY), mockState);
    expect(strategy.state).toMatchObject({strategyLastFills: {lastBuyPrice: '100', lastSellPrice: null}});
  });

  it('still tracks prices when a subclass overrides the fill hook (no super call needed)', async () => {
    const strategy = new FillHookStrategy();
    await strategy.onFill(makeFill('100', '1', OrderSide.BUY), mockState);
    expect(strategy.fillCount).toBe(1); // the subclass hook ran
    expect(strategy.lastBuyPrice?.toNumber()).toBe(100); // and the base tracked the price on its own
  });

  it('stores state and calls the hydrateState hook on restore (no super call needed)', () => {
    const strategy = new RestoreHookStrategy();
    strategy.restoreState({foo: 'bar'});
    expect(strategy.state).toMatchObject({foo: 'bar'}); // the base stored the snapshot
    expect(strategy.hydrated).toEqual({foo: 'bar'}); // the subclass hook ran without chaining super
  });
});
