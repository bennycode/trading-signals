import Big from 'big.js';
import {ms} from 'ms';
import {describe, expect, it, vi} from 'vitest';
import {z} from 'zod';
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
  OneMinuteBatchedCandle,
  OrderAdvice,
  TradingSessionState,
} from '@typedtrader/exchange';
import {GuardedStrategy, GuardedStrategySchema} from './GuardedStrategy.js';

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

const ONE_MINUTE_IN_MS = ms('1m');

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

const TestSchema = GuardedStrategySchema.extend({
  signalAdvice: z.boolean().optional(),
});

/**
 * Minimal GuardedStrategy subclass that records whether its own logic ran
 * and optionally returns a dummy BUY advice so we can assert that guards
 * take priority over subclass logic.
 */
class TestGuardedStrategy extends GuardedStrategy {
  ownLogicCallCount = 0;

  constructor(config: z.infer<typeof TestSchema>) {
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

    const config = this.config as z.infer<typeof TestSchema>;
    if (config.signalAdvice) {
      return {
        side: ExchangeOrderSide.BUY,
        type: ExchangeOrderType.MARKET,
        amount: null,
        amountIn: 'counter',
        reason: 'test buy',
      };
    }
  }
}

describe('GuardedStrategySchema', () => {
  it('accepts valid thresholds', () => {
    expect(() => GuardedStrategySchema.parse({stopLossPct: '5', takeProfitPct: '10'})).not.toThrow();
  });

  it('accepts empty config (no guards)', () => {
    expect(() => GuardedStrategySchema.parse({})).not.toThrow();
  });

  it('rejects non-positive thresholds', () => {
    expect(() => GuardedStrategySchema.parse({stopLossPct: '0'})).toThrow();
    expect(() => GuardedStrategySchema.parse({stopLossPct: '-1'})).toThrow();
    expect(() => GuardedStrategySchema.parse({takeProfitPct: '-0.5'})).toThrow();
  });

  it('rejects non-numeric strings', () => {
    expect(() => GuardedStrategySchema.parse({stopLossPct: 'abc'})).toThrow();
  });
});

describe('GuardedStrategy', () => {
  describe('stop-loss', () => {
    it('fires a LIMIT sell at the nominal target price when unrealized loss reaches the threshold', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      // Price drops 5% — stop-loss should fire
      const advice = await strategy.onCandle(makeCandle(95), mockState);

      assertLimitSell(advice);
      expect(advice.amount).toBeNull();
      expect(advice.amountIn).toBe('base');
      expect(new Big(advice.price).toFixed(2)).toBe('95.00');
      expect(advice.reason).toContain('[KILL SWITCH]');
      expect(advice.reason).toContain('Stop-loss');
      expect(strategy.guardState.killedLimitPrice).toBe('95');
    });

    it('places the limit at the nominal target even when the market has gapped below', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      // Market gaps to 90 (-10%), far past the -5% threshold — limit still sits at 95
      const advice = await strategy.onCandle(makeCandle(90), mockState);

      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('95.00');
    });

    it('does not fire while within threshold', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      // Price drops only 3% — guard should pass, subclass runs
      const advice = await strategy.onCandle(makeCandle(97), mockState);

      expect(advice).toBeUndefined();
      expect(strategy.ownLogicCallCount).toBe(1);
    });
  });

  describe('take-profit', () => {
    it('fires a LIMIT sell at the nominal target price when unrealized gain reaches the threshold', async () => {
      const strategy = new TestGuardedStrategy({takeProfitPct: '10'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(110), mockState);

      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('110.00');
      expect(advice.reason).toContain('[KILL SWITCH]');
      expect(advice.reason).toContain('Take-profit');
      expect(strategy.guardState.killedLimitPrice).toBe('110');
    });

    it('does not fire while within threshold', async () => {
      const strategy = new TestGuardedStrategy({takeProfitPct: '10'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(105), mockState);

      expect(advice).toBeUndefined();
      expect(strategy.ownLogicCallCount).toBe(1);
    });
  });

  describe('no position', () => {
    it('skips guard checks when nothing has been bought', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '1', takeProfitPct: '1', signalAdvice: true});

      const advice = await strategy.onCandle(makeCandle(100), mockState);

      expect(advice).toBeDefined();
      expect(advice!.side).toBe(ExchangeOrderSide.BUY);
      expect(strategy.ownLogicCallCount).toBe(1);
    });
  });

  describe('killed state', () => {
    it('keeps re-emitting the same limit-sell advice while the position has not yet been exited', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5', signalAdvice: true});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      // Trigger stop-loss — position is still 10 because no sell fill has arrived yet
      const killAdvice = await strategy.onCandle(makeCandle(94), mockState);
      assertLimitSell(killAdvice);
      expect(new Big(killAdvice.price).toFixed(2)).toBe('95.00');
      expect(strategy.guardState.killed).toBe(true);

      // Simulate exchange rejecting/delaying the fill: next candle must retry with
      // the same nominal limit price, regardless of where the market is now.
      const retryAdvice = await strategy.onCandle(makeCandle(120), mockState);
      assertLimitSell(retryAdvice);
      expect(new Big(retryAdvice.price).toFixed(2)).toBe('95.00');
      expect(retryAdvice.reason).toContain('[KILL SWITCH]');

      // Subclass logic must never run while killed, even during retries
      expect(strategy.ownLogicCallCount).toBe(0);
    });

    it('goes silent once the position is fully exited via onFill', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5', signalAdvice: true});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      await strategy.onCandle(makeCandle(94), mockState);
      expect(strategy.guardState.killed).toBe(true);

      // The sell advice finally fills — position goes to zero
      await strategy.onFill(makeFill('94', '10', ExchangeOrderSide.SELL), mockState);
      expect(strategy.guardState.totalPositionSize).toBe('0');

      // Now subsequent candles return undefined — truly terminal
      const advice = await strategy.onCandle(makeCandle(120), mockState);
      expect(advice).toBeUndefined();
      expect(strategy.ownLogicCallCount).toBe(0);
    });
  });

  describe('position tracking', () => {
    it('uses cost-basis averaging across multiple buys to compute the limit price', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});

      // Buy 10 @ 100, then 10 @ 120 → avg = 110
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);
      await strategy.onFill(makeFill('120', '10', ExchangeOrderSide.BUY), mockState);

      // -5% of 110 = 104.5. At 105, no fire. At 104, fires.
      const notYet = await strategy.onCandle(makeCandle(105), mockState);
      expect(notYet).toBeUndefined();

      const fires = await strategy.onCandle(makeCandle(104), mockState);
      assertLimitSell(fires);
      // Nominal limit price is 110 * 0.95 = 104.5 (NOT the candle close of 104)
      expect(new Big(fires.price).toFixed(2)).toBe('104.50');
    });

    it('uses the current average entry price after a partial sell', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});

      // Buy 20 @ 100, then sell 10 (partial exit). Avg entry stays at 100.
      await strategy.onFill(makeFill('100', '20', ExchangeOrderSide.BUY), mockState);
      await strategy.onFill(makeFill('110', '10', ExchangeOrderSide.SELL), mockState);

      const fires = await strategy.onCandle(makeCandle(95), mockState);
      assertLimitSell(fires);
      // Limit is nominal 5% below the preserved avg entry of 100 → 95
      expect(new Big(fires.price).toFixed(2)).toBe('95.00');
    });

    it('resets position tracking to zero on a full exit', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});

      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);
      await strategy.onFill(makeFill('110', '10', ExchangeOrderSide.SELL), mockState);

      expect(strategy.guardState.totalPositionSize).toBe('0');
      expect(strategy.guardState.totalCostBasis).toBe('0');

      // After a full exit, the guard should not fire on any price move — no position
      const advice = await strategy.onCandle(makeCandle(1), mockState);
      expect(advice).toBeUndefined();
    });
  });

  describe('no guards configured', () => {
    it('always passes through to the subclass', async () => {
      const strategy = new TestGuardedStrategy({signalAdvice: true});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      // Price crashes 99% — guard still does nothing because no thresholds set
      const advice = await strategy.onCandle(makeCandle(1), mockState);

      expect(advice).toBeDefined();
      expect(advice!.side).toBe(ExchangeOrderSide.BUY);
      expect(strategy.ownLogicCallCount).toBe(1);
    });
  });

  describe('state persistence', () => {
    it('restores guard state through restoreState', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const snapshot = strategy.state;
      expect(snapshot).not.toBeNull();

      // New instance, restore state
      const restored = new TestGuardedStrategy({stopLossPct: '5'});
      restored.restoreState(snapshot!);

      // The restored strategy should know about the position and fire at -5%
      const advice = await restored.onCandle(makeCandle(95), mockState);
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('95.00');
    });

    it('restores the killedLimitPrice after a guard has already fired', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);
      await strategy.onCandle(makeCandle(95), mockState); // fire the guard
      expect(strategy.guardState.killed).toBe(true);

      const snapshot = strategy.state;

      const restored = new TestGuardedStrategy({stopLossPct: '5'});
      restored.restoreState(snapshot!);
      expect(restored.guardState.killed).toBe(true);
      expect(restored.guardState.killedLimitPrice).toBe('95');

      // Retry on the restored instance should re-emit the same limit advice
      const advice = await restored.onCandle(makeCandle(50), mockState);
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('95.00');
    });

    it('applies default guard state when restoring legacy state without __guard', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});

      // Simulate state persisted before guards existed — no __guard key
      strategy.restoreState({ownField: 42});

      expect(strategy.guardState.killed).toBe(false);
      expect(strategy.guardState.totalPositionSize).toBe('0');
      expect(strategy.guardState.totalCostBasis).toBe('0');
    });
  });

  describe('persistence (onSave)', () => {
    it('fires onSave when onFill accumulates a BUY', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});
      const onSave = vi.fn();
      strategy.onSave = onSave;

      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      expect(onSave).toHaveBeenCalled();
    });

    it('fires onSave when onFill reduces the position on a SELL', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const onSave = vi.fn();
      strategy.onSave = onSave;

      await strategy.onFill(makeFill('110', '5', ExchangeOrderSide.SELL), mockState);

      expect(onSave).toHaveBeenCalled();
    });

    it('fires onSave when a guard fires during processCandle', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const onSave = vi.fn();
      strategy.onSave = onSave;

      await strategy.onCandle(makeCandle(94), mockState);

      expect(onSave).toHaveBeenCalled();
    });
  });

  describe('guard priority', () => {
    it('stop-loss takes priority — subclass logic does not run when fired', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5', signalAdvice: true});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(90), mockState);

      assertLimitSell(advice);
      expect(advice.reason).toContain('Stop-loss');
      expect(strategy.ownLogicCallCount).toBe(0);
    });

    it('stop-loss fires before take-profit when both configured and loss is hit first', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5', takeProfitPct: '10'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(94), mockState);
      assertLimitSell(advice);
      expect(advice.reason).toContain('Stop-loss');
    });
  });
});
