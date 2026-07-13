import Big from 'big.js';
import {ms} from 'ms';
import {describe, expect, it, vi} from 'vitest';
import {z} from 'zod';
import {CandleBatcher, OrderPosition, OrderSide, OrderType, TradingPair} from '@typedtrader/exchange';
import {AllAvailableAmount} from '../trader/index.js';
import type {Candle, Fill, PendingOrder, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {LimitOrderAdvice, MarketOrderAdvice, OrderAdvice, TradingSessionState} from '../trader/index.js';
import {ProtectedStrategy, ProtectedStrategySchema} from './ProtectedStrategy.js';

function assertLimitSell(advice: OrderAdvice | void): asserts advice is LimitOrderAdvice {
  if (!advice || advice.type !== OrderType.LIMIT || advice.side !== OrderSide.SELL) {
    throw new Error(`Expected a LIMIT SELL advice but received ${JSON.stringify(advice)}`);
  }
}

function assertMarketSell(advice: OrderAdvice | void): asserts advice is MarketOrderAdvice {
  if (!advice || advice.type !== OrderType.MARKET || advice.side !== OrderSide.SELL) {
    throw new Error(`Expected a MARKET SELL advice but received ${JSON.stringify(advice)}`);
  }
}

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

/**
 * A state holding `base` units. Guards read the live base balance for quantity and to decide
 * whether there is a position at all, so tests pass the balance they are simulating.
 */
function held(base: number): TradingSessionState {
  return {...mockState, baseBalance: new Big(base)};
}

const ONE_MINUTE_IN_MS = ms('1m');

function makeCandle(close: number, index = 0): OneMinuteBatchedCandle {
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

function makeOrder(side: OrderSide, type: OrderType = OrderType.LIMIT): PendingOrder {
  if (type === OrderType.LIMIT) {
    return {id: 'order-1', pair, price: '100', side, size: '10', type: OrderType.LIMIT};
  }
  return {id: 'order-1', pair, side, size: '10', type: OrderType.MARKET};
}

const TestSchema = ProtectedStrategySchema.extend({
  signalAdvice: z.boolean().optional(),
});

/**
 * Minimal ProtectedStrategy subclass that records whether its own logic ran
 * and optionally returns a dummy BUY advice so we can assert that guards
 * take priority over subclass logic.
 */
class TestProtectedStrategy extends ProtectedStrategy {
  ownLogicCallCount = 0;

  constructor(config: z.input<typeof TestSchema>) {
    super({config, state: {ownField: 0}});
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    const guardAdvice = await super.processCandle(candle, state);
    if (guardAdvice) {
      return guardAdvice;
    }

    this.ownLogicCallCount++;

    const storedConfig = this.config;
    const shouldSignal = storedConfig !== null && storedConfig.signalAdvice === true;
    if (shouldSignal) {
      return {
        amount: AllAvailableAmount,
        amountIn: 'counter',
        reason: 'test buy',
        side: OrderSide.BUY,
        type: OrderType.MARKET,
      };
    }
  }
}

describe('ProtectedStrategySchema', () => {
  it('accepts valid thresholds inside the protected sub-object', () => {
    expect(() => ProtectedStrategySchema.parse({protected: {stopLossPct: '5', takeProfitPct: '10'}})).not.toThrow();
  });

  it('accepts empty config (no protected key at all)', () => {
    expect(() => ProtectedStrategySchema.parse({})).not.toThrow();
  });

  it('accepts empty protected object', () => {
    expect(() => ProtectedStrategySchema.parse({protected: {}})).not.toThrow();
  });

  it('rejects non-positive thresholds', () => {
    expect(() => ProtectedStrategySchema.parse({protected: {stopLossPct: '0'}})).toThrow();
    expect(() => ProtectedStrategySchema.parse({protected: {stopLossPct: '-1'}})).toThrow();
    expect(() => ProtectedStrategySchema.parse({protected: {takeProfitPct: '-0.5'}})).toThrow();
  });

  it('rejects non-numeric strings', () => {
    expect(() => ProtectedStrategySchema.parse({protected: {stopLossPct: 'abc'}})).toThrow();
  });

  it('applies default order types when omitted', () => {
    const parsed = ProtectedStrategySchema.parse({protected: {stopLossPct: '5'}});
    expect(parsed.protected).toBeDefined();
    expect(parsed.protected?.stopLossOrder).toBe('limit');
    expect(parsed.protected?.takeProfitOrder).toBe('limit');
  });
});

describe('ProtectedStrategy', () => {
  describe('stop-loss', () => {
    it('fires a LIMIT sell at the nominal target price when the loss reaches the threshold', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      // Price drops 5% — stop-loss should fire
      const advice = await strategy.onCandle(makeCandle(95), held(10));

      assertLimitSell(advice);
      expect(advice.amount).toBe(AllAvailableAmount);
      expect(advice.amountIn).toBe('base');
      expect(new Big(advice.price).toFixed(2)).toBe('95.00');
      expect(advice.reason).toContain('[KILL SWITCH]');
      expect(advice.reason).toContain('Stop-loss');
      expect(strategy.protectedState.killedLimitPrice).toBe('95');
    });

    it('places the limit at the nominal target even when the market has gapped below', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      // Market gaps to 90 (-10%), far past the -5% threshold — limit still sits at 95
      const advice = await strategy.onCandle(makeCandle(90), held(10));

      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('95.00');
    });

    it('does not fire while within threshold', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      // Price drops only 3% — guard should pass, subclass runs
      const advice = await strategy.onCandle(makeCandle(97), held(10));

      expect(advice).toBeUndefined();
      expect(strategy.ownLogicCallCount).toBe(1);
    });

    it('fires a LIMIT sell at the nominal USD loss target when stopLossNominal is reached', async () => {
      /*
       * 10 shares @ 100. stopLossNominal=10 → exit when the unrealized loss is $10, i.e. a
       * price of 99 (each of the 10 shares only needs to drop $1).
       */
      const strategy = new TestProtectedStrategy({protected: {stopLossNominal: '10'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const notYet = await strategy.onCandle(makeCandle(99.5), held(10));
      expect(notYet).toBeUndefined();

      const advice = await strategy.onCandle(makeCandle(99), held(10));
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('99.00');
      expect(advice.reason).toContain('Stop-loss');
      expect(advice.reason).toContain('unrealized');
    });

    it('fires a LIMIT sell at the exact configured price when stopLossPrice is reached', async () => {
      // stopLossPrice=92 → limit sell at exactly 92 as soon as price drops to 92 or below
      const strategy = new TestProtectedStrategy({protected: {stopLossPrice: '92'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const notYet = await strategy.onCandle(makeCandle(93), held(10));
      expect(notYet).toBeUndefined();

      const advice = await strategy.onCandle(makeCandle(92), held(10));
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('92.00');
      expect(advice.reason).toContain('Stop-loss');
      expect(advice.reason).toContain('target 92');
    });

    it('fires at the configured price regardless of the entry', async () => {
      // Buy at 50 — far below the 92 stopLossPrice. Guard still arms and fires at 92.
      const strategy = new TestProtectedStrategy({protected: {stopLossPrice: '92'}});
      await strategy.onFill(makeFill('50', '10', OrderSide.BUY), mockState);

      // Price above the stop target — no fire even though we're above entry
      const notYet = await strategy.onCandle(makeCandle(100), held(10));
      expect(notYet).toBeUndefined();

      const advice = await strategy.onCandle(makeCandle(92), held(10));
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('92.00');
    });
  });

  describe('take-profit', () => {
    it('fires a LIMIT sell at the nominal target price when the gain reaches the threshold', async () => {
      const strategy = new TestProtectedStrategy({protected: {takeProfitPct: '10'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(110), held(10));

      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('110.00');
      expect(advice.reason).toContain('[KILL SWITCH]');
      expect(advice.reason).toContain('Take-profit');
      expect(strategy.protectedState.killedLimitPrice).toBe('110');
    });

    it('fires a LIMIT sell at the nominal USD target when takeProfitNominal is reached', async () => {
      /*
       * 10 shares @ 100. takeProfitNominal=10 → exit when the unrealized gain is $10, i.e. a
       * price of 101 (each of the 10 shares only needs to gain $1).
       */
      const strategy = new TestProtectedStrategy({protected: {takeProfitNominal: '10'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const notYet = await strategy.onCandle(makeCandle(100.5), held(10));
      expect(notYet).toBeUndefined();

      const advice = await strategy.onCandle(makeCandle(101), held(10));
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('101.00');
      expect(advice.reason).toContain('Take-profit');
      expect(advice.reason).toContain('unrealized');
    });

    it('fires a LIMIT sell at the exact configured price when takeProfitPrice is reached', async () => {
      // takeProfitPrice=108 → limit sell at exactly 108 as soon as price rises to 108 or above
      const strategy = new TestProtectedStrategy({protected: {takeProfitPrice: '108'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const notYet = await strategy.onCandle(makeCandle(107), held(10));
      expect(notYet).toBeUndefined();

      const advice = await strategy.onCandle(makeCandle(108), held(10));
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('108.00');
      expect(advice.reason).toContain('Take-profit');
      expect(advice.reason).toContain('target 108');
    });

    it('does not fire while within threshold', async () => {
      const strategy = new TestProtectedStrategy({protected: {takeProfitPct: '10'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(105), held(10));

      expect(advice).toBeUndefined();
      expect(strategy.ownLogicCallCount).toBe(1);
    });
  });

  describe('no position', () => {
    it('skips guard checks when nothing has been bought', async () => {
      const strategy = new TestProtectedStrategy({
        protected: {stopLossPct: '1', takeProfitPct: '1'},
        signalAdvice: true,
      });

      const advice = await strategy.onCandle(makeCandle(100), mockState);

      expect(advice).toBeDefined();
      expect(advice?.side).toBe(OrderSide.BUY);
      expect(strategy.ownLogicCallCount).toBe(1);
    });
  });

  describe('seedFromBalance', () => {
    const stateWithPosition = held(10);

    it('seeds the entry price from the first candle close', async () => {
      const strategy = new TestProtectedStrategy({protected: {seedFromBalance: true, stopLossPct: '5'}});

      // First candle at 100 with 10 shares in the account → seeds the entry at 100
      await strategy.onCandle(makeCandle(100), stateWithPosition);

      expect(strategy.protectedState.seedEntryPrice).toBe('100');
    });

    it('fires stop-loss relative to the seeded baseline price', async () => {
      const strategy = new TestProtectedStrategy({protected: {seedFromBalance: true, stopLossPct: '5'}});

      // Seed at 100
      await strategy.onCandle(makeCandle(100), stateWithPosition);

      // Price drops 5% → should fire
      const advice = await strategy.onCandle(makeCandle(95), stateWithPosition);
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('95.00');
    });

    it('fires take-profit relative to the seeded baseline price', async () => {
      const strategy = new TestProtectedStrategy({protected: {seedFromBalance: true, takeProfitPct: '10'}});

      // Seed at 100
      await strategy.onCandle(makeCandle(100), stateWithPosition);

      // Price rises 10% → should fire
      const advice = await strategy.onCandle(makeCandle(110), stateWithPosition);
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('110.00');
    });

    it('does not seed when baseBalance is zero', async () => {
      const strategy = new TestProtectedStrategy({
        protected: {seedFromBalance: true, stopLossPct: '5'},
        signalAdvice: true,
      });

      const advice = await strategy.onCandle(makeCandle(100), mockState);

      expect(strategy.protectedState.seedEntryPrice).toBeNull();
      expect(advice).toBeDefined();
      expect(advice?.side).toBe(OrderSide.BUY);
    });

    it('does not seed when seedFromBalance is false (default)', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}, signalAdvice: true});

      const advice = await strategy.onCandle(makeCandle(100), stateWithPosition);

      expect(strategy.protectedState.seedEntryPrice).toBeNull();
      expect(advice).toBeDefined();
      expect(advice?.side).toBe(OrderSide.BUY);
    });

    it('does not seed when a buy fill already set the entry', async () => {
      const strategy = new TestProtectedStrategy({protected: {seedFromBalance: true, stopLossPct: '5'}});

      // Entry established by a real buy at 80
      await strategy.onFill(makeFill('80', '10', OrderSide.BUY), mockState);

      // Candle at 100 should NOT seed — the last buy price is the entry
      await strategy.onCandle(makeCandle(100), stateWithPosition);

      expect(strategy.protectedState.seedEntryPrice).toBeNull();
      expect(strategy.lastBuyPrice?.toFixed()).toBe('80');
    });

    it('persists the seeded entry through restoreState', async () => {
      const strategy = new TestProtectedStrategy({protected: {seedFromBalance: true, stopLossPct: '5'}});
      await strategy.onCandle(makeCandle(100), stateWithPosition);

      const snapshot = strategy.state;

      const restored = new TestProtectedStrategy({protected: {seedFromBalance: true, stopLossPct: '5'}});
      restored.restoreState(snapshot!);

      expect(restored.protectedState.seedEntryPrice).toBe('100');

      // Guard should fire on the restored instance relative to the seeded entry
      const advice = await restored.onCandle(makeCandle(95), stateWithPosition);
      assertLimitSell(advice);
    });
  });

  describe('killed state', () => {
    it('keeps re-emitting the same limit-sell advice while the position has not yet been exited', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}, signalAdvice: true});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      // Trigger stop-loss — the position is still held, so the exit re-emits
      const killAdvice = await strategy.onCandle(makeCandle(94), held(10));
      assertLimitSell(killAdvice);
      expect(new Big(killAdvice.price).toFixed(2)).toBe('95.00');
      expect(strategy.protectedState.killed).toBe(true);

      /*
       * Simulate the exchange rejecting/delaying the fill: the next candle must retry with
       * the same nominal limit price, regardless of where the market is now.
       */
      const retryAdvice = await strategy.onCandle(makeCandle(120), held(10));
      assertLimitSell(retryAdvice);
      expect(new Big(retryAdvice.price).toFixed(2)).toBe('95.00');
      expect(retryAdvice.reason).toContain('[KILL SWITCH]');

      // Subclass logic must never run while killed, even during retries
      expect(strategy.ownLogicCallCount).toBe(0);
    });

    it('goes silent once the position has been fully exited', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}, signalAdvice: true});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      await strategy.onCandle(makeCandle(94), held(10));
      expect(strategy.protectedState.killed).toBe(true);

      // The sell fills and the balance drains — subsequent candles return undefined (terminal)
      const advice = await strategy.onCandle(makeCandle(120), mockState);
      expect(advice).toBeUndefined();
      expect(strategy.ownLogicCallCount).toBe(0);
    });

    it('fires onFinish when the session reports the killed sell order fully filled', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      const onFinish = vi.fn();
      strategy.onFinish = onFinish;

      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);
      await strategy.onCandle(makeCandle(94), held(10));
      expect(strategy.protectedState.killed).toBe(true);
      expect(onFinish).not.toHaveBeenCalled();

      // Kill-switch sell actually fills → session reports order done
      await strategy.onOrderFilled(makeOrder(OrderSide.SELL), mockState);
      expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it('does not fire onFinish when a sell order fills while un-killed', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      const onFinish = vi.fn();
      strategy.onFinish = onFinish;

      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);
      await strategy.onOrderFilled(makeOrder(OrderSide.SELL), mockState);

      expect(strategy.protectedState.killed).toBe(false);
      expect(onFinish).not.toHaveBeenCalled();
    });

    it('does not fire onFinish when a BUY order fills while killed', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      const onFinish = vi.fn();
      strategy.onFinish = onFinish;

      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);
      await strategy.onCandle(makeCandle(94), held(10));
      expect(strategy.protectedState.killed).toBe(true);

      // A BUY order completing (shouldn't happen in practice once killed, but guard anyway)
      await strategy.onOrderFilled(makeOrder(OrderSide.BUY), mockState);
      expect(onFinish).not.toHaveBeenCalled();
    });
  });

  describe('entry price', () => {
    it('measures guards from the last buy price, not an average across buys', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});

      // Buy 10 @ 100, then 10 @ 120 → entry is the last buy of 120 (no averaging)
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);
      await strategy.onFill(makeFill('120', '10', OrderSide.BUY), mockState);

      // -5% of 120 = 114. At 115, no fire. At 114, fires.
      const notYet = await strategy.onCandle(makeCandle(115), held(20));
      expect(notYet).toBeUndefined();

      const fires = await strategy.onCandle(makeCandle(114), held(20));
      assertLimitSell(fires);
      expect(new Big(fires.price).toFixed(2)).toBe('114.00');
    });

    it('still measures from the last buy after a partial sell', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});

      // Buy 20 @ 100, then sell 10. The last buy price (100) stays the entry.
      await strategy.onFill(makeFill('100', '20', OrderSide.BUY), mockState);
      await strategy.onFill(makeFill('110', '10', OrderSide.SELL), mockState);

      // 10 shares remain; -5% of 100 → 95
      const fires = await strategy.onCandle(makeCandle(95), held(10));
      assertLimitSell(fires);
      expect(new Big(fires.price).toFixed(2)).toBe('95.00');
    });

    it('does not fire once the position is fully sold (no live balance)', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});

      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);
      await strategy.onFill(makeFill('110', '10', OrderSide.SELL), mockState);

      // No live balance → no position to protect, guard stays silent
      const advice = await strategy.onCandle(makeCandle(1), mockState);
      expect(advice).toBeUndefined();
    });
  });

  describe('no guards configured', () => {
    it('always passes through to the subclass', async () => {
      const strategy = new TestProtectedStrategy({signalAdvice: true});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      // Price crashes 99% — guard still does nothing because no thresholds set
      const advice = await strategy.onCandle(makeCandle(1), held(10));

      expect(advice).toBeDefined();
      expect(advice?.side).toBe(OrderSide.BUY);
      expect(strategy.ownLogicCallCount).toBe(1);
    });
  });

  describe('mutual exclusion', () => {
    it('rejects setting both stopLossPct and stopLossNominal', () => {
      expect(() => new TestProtectedStrategy({protected: {stopLossNominal: '10', stopLossPct: '5'}})).toThrow(
        /stopLossPct, stopLossNominal, and stopLossPrice are mutually exclusive/
      );
    });

    it('rejects setting both takeProfitPct and takeProfitNominal', () => {
      expect(() => new TestProtectedStrategy({protected: {takeProfitNominal: '5', takeProfitPct: '10'}})).toThrow(
        /takeProfitPct, takeProfitNominal, and takeProfitPrice are mutually exclusive/
      );
    });

    it('rejects setting both stopLossPct and stopLossPrice', () => {
      expect(() => new TestProtectedStrategy({protected: {stopLossPct: '5', stopLossPrice: '95'}})).toThrow(
        /stopLossPct, stopLossNominal, and stopLossPrice are mutually exclusive/
      );
    });

    it('rejects setting both stopLossNominal and stopLossPrice', () => {
      expect(() => new TestProtectedStrategy({protected: {stopLossNominal: '10', stopLossPrice: '95'}})).toThrow(
        /stopLossPct, stopLossNominal, and stopLossPrice are mutually exclusive/
      );
    });

    it('rejects setting both takeProfitPct and takeProfitPrice', () => {
      expect(() => new TestProtectedStrategy({protected: {takeProfitPct: '10', takeProfitPrice: '110'}})).toThrow(
        /takeProfitPct, takeProfitNominal, and takeProfitPrice are mutually exclusive/
      );
    });

    it('rejects setting both takeProfitNominal and takeProfitPrice', () => {
      expect(() => new TestProtectedStrategy({protected: {takeProfitNominal: '10', takeProfitPrice: '110'}})).toThrow(
        /takeProfitPct, takeProfitNominal, and takeProfitPrice are mutually exclusive/
      );
    });

    it('rejects setting all three stop-loss variants', () => {
      expect(
        () => new TestProtectedStrategy({protected: {stopLossNominal: '10', stopLossPct: '5', stopLossPrice: '95'}})
      ).toThrow(/stopLossPct, stopLossNominal, and stopLossPrice are mutually exclusive/);
    });

    it('allows mixing pct on one direction with nominal on the other', async () => {
      /*
       * stopLossPct 5 + takeProfitNominal 10 on 10 @ 100
       *   → stop-loss target: 100 * 0.95 = 95
       *   → take-profit target: 100 + 10/10 = 101
       */
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5', takeProfitNominal: '10'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      // Hits take-profit first at 101
      const advice = await strategy.onCandle(makeCandle(101), held(10));
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('101.00');
      expect(advice.reason).toContain('Take-profit');
    });

    it('allows mixing nominal stop-loss with pct take-profit', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossNominal: '10', takeProfitPct: '10'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      // -$10 at 10 shares → price 99
      const advice = await strategy.onCandle(makeCandle(99), held(10));
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('99.00');
      expect(advice.reason).toContain('Stop-loss');
    });
  });

  describe('nominal guard sizing', () => {
    it('divides the nominal target by the live position size', async () => {
      const strategy = new TestProtectedStrategy({protected: {takeProfitNominal: '20'}});

      // Buy 10 @ 100, then 10 @ 120 → entry is the last buy of 120, live size 20
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);
      await strategy.onFill(makeFill('120', '10', OrderSide.BUY), mockState);

      // +$20 target at 20 shares → each share needs to gain $1 from entry → target 121
      const notYet = await strategy.onCandle(makeCandle(120.5), held(20));
      expect(notYet).toBeUndefined();

      const advice = await strategy.onCandle(makeCandle(121), held(20));
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('121.00');
    });
  });

  describe('state persistence', () => {
    it('restores guard state through restoreState', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const snapshot = strategy.state;
      expect(snapshot).not.toBeNull();

      // New instance, restore state
      const restored = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      restored.restoreState(snapshot!);

      // The restored strategy knows the last buy price and fires at -5%
      const advice = await restored.onCandle(makeCandle(95), held(10));
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('95.00');
    });

    it('restores the killedLimitPrice after a guard has already fired', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);
      await strategy.onCandle(makeCandle(95), held(10)); // fire the guard
      expect(strategy.protectedState.killed).toBe(true);

      const snapshot = strategy.state;

      const restored = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      restored.restoreState(snapshot!);
      expect(restored.protectedState.killed).toBe(true);
      expect(restored.protectedState.killedLimitPrice).toBe('95');

      // Retry on the restored instance should re-emit the same limit advice
      const advice = await restored.onCandle(makeCandle(50), held(10));
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('95.00');
    });

    it('applies default guard state when restoring legacy state without a protected key', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});

      // Simulate state persisted before guards existed — no `protected` key
      strategy.restoreState({ownField: 42});

      expect(strategy.protectedState.killed).toBe(false);
      expect(strategy.protectedState.seedEntryPrice).toBeNull();
    });

    it('falls back to defaults when restored state has killed=true but no killedOrderType', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});

      /*
       * Inconsistent persisted state: marked killed but missing the order type
       * needed for the retry path. Must not silently accept.
       */
      strategy.restoreState({
        protected: {
          killed: true,
          killedLimitPrice: null,
          killedOrderType: null,
          killedReason: 'stale',
          seedEntryPrice: null,
        },
      });

      expect(strategy.protectedState.killed).toBe(false);
    });

    it('falls back to defaults when killedOrderType="limit" but killedLimitPrice is null', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});

      strategy.restoreState({
        protected: {
          killed: true,
          killedLimitPrice: null,
          killedOrderType: 'limit',
          killedReason: 'stale',
          seedEntryPrice: null,
        },
      });

      expect(strategy.protectedState.killed).toBe(false);
    });

    it('accepts killed=true with killedOrderType="market" and no limit price', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});

      strategy.restoreState({
        protected: {
          killed: true,
          killedLimitPrice: null,
          killedOrderType: 'market',
          killedReason: 'Stop-loss fired',
          seedEntryPrice: null,
        },
      });

      expect(strategy.protectedState.killed).toBe(true);
      expect(strategy.protectedState.killedOrderType).toBe('market');
    });

    it('falls back to defaults when seedEntryPrice is not a valid numeric string', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});

      strategy.restoreState({
        protected: {
          killed: false,
          killedLimitPrice: null,
          killedOrderType: null,
          killedReason: null,
          seedEntryPrice: 'not-a-number',
        },
      });

      expect(strategy.protectedState.seedEntryPrice).toBeNull();
      expect(strategy.protectedState.killed).toBe(false);
    });

    it('falls back to defaults when killedLimitPrice is not a valid numeric string', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});

      strategy.restoreState({
        protected: {
          killed: true,
          killedLimitPrice: 'garbage',
          killedOrderType: 'limit',
          killedReason: null,
          seedEntryPrice: null,
        },
      });

      expect(strategy.protectedState.killed).toBe(false);
    });
  });

  describe('persistence (onSave)', () => {
    it('fires onSave when onFill records a buy', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      const onSave = vi.fn();
      strategy.onSave = onSave;

      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      expect(onSave).toHaveBeenCalled();
    });

    it('fires onSave when onFill records a sell', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const onSave = vi.fn();
      strategy.onSave = onSave;

      await strategy.onFill(makeFill('110', '5', OrderSide.SELL), mockState);

      expect(onSave).toHaveBeenCalled();
    });

    it('fires onSave when a guard fires during processCandle', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const onSave = vi.fn();
      strategy.onSave = onSave;

      await strategy.onCandle(makeCandle(94), held(10));

      expect(onSave).toHaveBeenCalled();
    });
  });

  describe('guard priority', () => {
    it('stop-loss takes priority — subclass logic does not run when fired', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}, signalAdvice: true});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(90), held(10));

      assertLimitSell(advice);
      expect(advice.reason).toContain('Stop-loss');
      expect(strategy.ownLogicCallCount).toBe(0);
    });

    it('stop-loss fires before take-profit when both configured and loss is hit first', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5', takeProfitPct: '10'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(94), held(10));
      assertLimitSell(advice);
      expect(advice.reason).toContain('Stop-loss');
    });
  });

  describe('order type (stopLossOrder / takeProfitOrder)', () => {
    it('defaults stopLossOrder to "limit" when not configured', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossPct: '5'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(95), held(10));
      assertLimitSell(advice);
      expect(strategy.protectedState.killedOrderType).toBe('limit');
    });

    it('defaults takeProfitOrder to "limit" when not configured', async () => {
      const strategy = new TestProtectedStrategy({protected: {takeProfitPct: '10'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(110), held(10));
      assertLimitSell(advice);
      expect(strategy.protectedState.killedOrderType).toBe('limit');
    });

    it('fires a MARKET sell when stopLossOrder is "market"', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossOrder: 'market', stopLossPct: '5'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(95), held(10));
      assertMarketSell(advice);
      expect(advice.amount).toBe(AllAvailableAmount);
      expect(advice.amountIn).toBe('base');
      expect(advice.reason).toContain('[KILL SWITCH]');
      expect(advice.reason).toContain('Stop-loss');
      expect(advice.reason).toContain('(market)');
      expect(strategy.protectedState.killedOrderType).toBe('market');
      // No limit price stored for market orders
      expect(strategy.protectedState.killedLimitPrice).toBeNull();
    });

    it('fires a MARKET sell when takeProfitOrder is "market"', async () => {
      const strategy = new TestProtectedStrategy({protected: {takeProfitOrder: 'market', takeProfitPct: '10'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(110), held(10));
      assertMarketSell(advice);
      expect(advice.reason).toContain('Take-profit');
      expect(advice.reason).toContain('(market)');
      expect(strategy.protectedState.killedOrderType).toBe('market');
      expect(strategy.protectedState.killedLimitPrice).toBeNull();
    });

    it('can mix a market stop-loss with a limit take-profit', async () => {
      const strategy = new TestProtectedStrategy({
        protected: {
          stopLossOrder: 'market',
          stopLossPct: '5',
          takeProfitPct: '10',
          // takeProfitOrder defaults to 'limit'
        },
      });
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const stopAdvice = await strategy.onCandle(makeCandle(95), held(10));
      assertMarketSell(stopAdvice);
    });

    it('can mix a limit stop-loss with a market take-profit', async () => {
      const strategy = new TestProtectedStrategy({
        protected: {
          stopLossPct: '5',
          takeProfitOrder: 'market',
          takeProfitPct: '10',
        },
      });
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      const profitAdvice = await strategy.onCandle(makeCandle(110), held(10));
      assertMarketSell(profitAdvice);
    });

    it('retries market advice on subsequent candles while the position is not exited', async () => {
      const strategy = new TestProtectedStrategy({
        protected: {stopLossOrder: 'market', stopLossPct: '5'},
        signalAdvice: true,
      });
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);

      // Fire
      const first = await strategy.onCandle(makeCandle(95), held(10));
      assertMarketSell(first);

      // Retry on next candle — position still held, should re-emit market sell
      const second = await strategy.onCandle(makeCandle(150), held(10));
      assertMarketSell(second);
      expect(strategy.ownLogicCallCount).toBe(0);
    });

    it('persists killedOrderType across restoreState', async () => {
      const strategy = new TestProtectedStrategy({protected: {stopLossOrder: 'market', stopLossPct: '5'}});
      await strategy.onFill(makeFill('100', '10', OrderSide.BUY), mockState);
      await strategy.onCandle(makeCandle(95), held(10)); // fire

      const snapshot = strategy.state;

      const restored = new TestProtectedStrategy({protected: {stopLossOrder: 'market', stopLossPct: '5'}});
      restored.restoreState(snapshot!);
      expect(restored.protectedState.killedOrderType).toBe('market');
      expect(restored.protectedState.killedLimitPrice).toBeNull();

      // Retry on restored instance should still be MARKET, not LIMIT
      const advice = await restored.onCandle(makeCandle(50), held(10));
      assertMarketSell(advice);
    });
  });
});
