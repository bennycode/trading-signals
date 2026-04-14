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
  MarketOrderAdvice,
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

function assertMarketSell(advice: OrderAdvice | void): asserts advice is MarketOrderAdvice {
  if (!advice || advice.type !== ExchangeOrderType.MARKET || advice.side !== ExchangeOrderSide.SELL) {
    throw new Error(`Expected a MARKET SELL advice but received ${JSON.stringify(advice)}`);
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

    it('fires a LIMIT sell at the nominal USD loss target when stopLossNominal is reached', async () => {
      // 10 shares @ 100 = $1000 invested. stopLossNominal=10 → exit when unrealized loss
      // is $10, i.e. price of 99 (each share only needs to drop $1).
      const strategy = new TestGuardedStrategy({stopLossNominal: '10'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const notYet = await strategy.onCandle(makeCandle(99.5), mockState);
      expect(notYet).toBeUndefined();

      const advice = await strategy.onCandle(makeCandle(99), mockState);
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('99.00');
      expect(advice.reason).toContain('Stop-loss');
      expect(advice.reason).toContain('unrealized');
    });

    it('fires a LIMIT sell at the exact configured price when stopLossPrice is reached', async () => {
      // stopLossPrice=92 → limit sell at exactly 92 as soon as price drops to 92 or below
      const strategy = new TestGuardedStrategy({stopLossPrice: '92'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const notYet = await strategy.onCandle(makeCandle(93), mockState);
      expect(notYet).toBeUndefined();

      const advice = await strategy.onCandle(makeCandle(92), mockState);
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('92.00');
      expect(advice.reason).toContain('Stop-loss');
      expect(advice.reason).toContain('target 92');
    });

    it('fires at the configured price regardless of avg entry', async () => {
      // Buy at 50 — far below the 92 stopLossPrice. Guard still arms and fires at 92.
      const strategy = new TestGuardedStrategy({stopLossPrice: '92'});
      await strategy.onFill(makeFill('50', '10', ExchangeOrderSide.BUY), mockState);

      // Price above the stop target — no fire even though we're above entry
      const notYet = await strategy.onCandle(makeCandle(100), mockState);
      expect(notYet).toBeUndefined();

      const advice = await strategy.onCandle(makeCandle(92), mockState);
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('92.00');
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

    it('fires a LIMIT sell at the nominal USD target when takeProfitNominal is reached', async () => {
      // 10 shares @ 100 = $1000 invested. takeProfitNominal=10 → exit when portfolio hits $1010,
      // i.e. price of 101 (each share only needs to gain $1).
      const strategy = new TestGuardedStrategy({takeProfitNominal: '10'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const notYet = await strategy.onCandle(makeCandle(100.5), mockState);
      expect(notYet).toBeUndefined();

      const advice = await strategy.onCandle(makeCandle(101), mockState);
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('101.00');
      expect(advice.reason).toContain('Take-profit');
      expect(advice.reason).toContain('unrealized');
    });

    it('fires a LIMIT sell at the exact configured price when takeProfitPrice is reached', async () => {
      // takeProfitPrice=108 → limit sell at exactly 108 as soon as price rises to 108 or above
      const strategy = new TestGuardedStrategy({takeProfitPrice: '108'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const notYet = await strategy.onCandle(makeCandle(107), mockState);
      expect(notYet).toBeUndefined();

      const advice = await strategy.onCandle(makeCandle(108), mockState);
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('108.00');
      expect(advice.reason).toContain('Take-profit');
      expect(advice.reason).toContain('target 108');
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

  describe('mutual exclusion', () => {
    it('rejects setting both stopLossPct and stopLossNominal', () => {
      expect(() => new TestGuardedStrategy({stopLossPct: '5', stopLossNominal: '10'})).toThrow(
        /stopLossPct, stopLossNominal, and stopLossPrice are mutually exclusive/
      );
    });

    it('rejects setting both takeProfitPct and takeProfitNominal', () => {
      expect(() => new TestGuardedStrategy({takeProfitPct: '10', takeProfitNominal: '5'})).toThrow(
        /takeProfitPct, takeProfitNominal, and takeProfitPrice are mutually exclusive/
      );
    });

    it('rejects setting both stopLossPct and stopLossPrice', () => {
      expect(() => new TestGuardedStrategy({stopLossPct: '5', stopLossPrice: '95'})).toThrow(
        /stopLossPct, stopLossNominal, and stopLossPrice are mutually exclusive/
      );
    });

    it('rejects setting both stopLossNominal and stopLossPrice', () => {
      expect(() => new TestGuardedStrategy({stopLossNominal: '10', stopLossPrice: '95'})).toThrow(
        /stopLossPct, stopLossNominal, and stopLossPrice are mutually exclusive/
      );
    });

    it('rejects setting both takeProfitPct and takeProfitPrice', () => {
      expect(() => new TestGuardedStrategy({takeProfitPct: '10', takeProfitPrice: '110'})).toThrow(
        /takeProfitPct, takeProfitNominal, and takeProfitPrice are mutually exclusive/
      );
    });

    it('rejects setting both takeProfitNominal and takeProfitPrice', () => {
      expect(() => new TestGuardedStrategy({takeProfitNominal: '10', takeProfitPrice: '110'})).toThrow(
        /takeProfitPct, takeProfitNominal, and takeProfitPrice are mutually exclusive/
      );
    });

    it('rejects setting all three stop-loss variants', () => {
      expect(
        () => new TestGuardedStrategy({stopLossPct: '5', stopLossNominal: '10', stopLossPrice: '95'})
      ).toThrow(/stopLossPct, stopLossNominal, and stopLossPrice are mutually exclusive/);
    });

    it('allows mixing pct on one direction with nominal on the other', async () => {
      // stopLossPct 5 + takeProfitNominal 10 on 10 @ 100
      //   → stop-loss target: 100 * 0.95 = 95
      //   → take-profit target: 100 + 10/10 = 101
      const strategy = new TestGuardedStrategy({stopLossPct: '5', takeProfitNominal: '10'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      // Hits take-profit first at 101
      const advice = await strategy.onCandle(makeCandle(101), mockState);
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('101.00');
      expect(advice.reason).toContain('Take-profit');
    });

    it('allows mixing nominal stop-loss with pct take-profit', async () => {
      const strategy = new TestGuardedStrategy({stopLossNominal: '10', takeProfitPct: '10'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      // -$10 at 10 shares → price 99
      const advice = await strategy.onCandle(makeCandle(99), mockState);
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('99.00');
      expect(advice.reason).toContain('Stop-loss');
    });
  });

  describe('nominal across multiple buys', () => {
    it('uses the current cost-basis / positionSize when computing the nominal target', async () => {
      const strategy = new TestGuardedStrategy({takeProfitNominal: '20'});

      // Buy 10 @ 100, then 10 @ 120 → positionSize 20, costBasis 2200, avgEntry 110
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);
      await strategy.onFill(makeFill('120', '10', ExchangeOrderSide.BUY), mockState);

      // +$20 target at 20 shares → each share needs to gain $1 from avg → target 111
      const notYet = await strategy.onCandle(makeCandle(110.5), mockState);
      expect(notYet).toBeUndefined();

      const advice = await strategy.onCandle(makeCandle(111), mockState);
      assertLimitSell(advice);
      expect(new Big(advice.price).toFixed(2)).toBe('111.00');
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

  describe('order type (stopLossOrder / takeProfitOrder)', () => {
    it('defaults stopLossOrder to "limit" when not configured', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(95), mockState);
      assertLimitSell(advice);
      expect(strategy.guardState.killedOrderType).toBe('limit');
    });

    it('defaults takeProfitOrder to "limit" when not configured', async () => {
      const strategy = new TestGuardedStrategy({takeProfitPct: '10'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(110), mockState);
      assertLimitSell(advice);
      expect(strategy.guardState.killedOrderType).toBe('limit');
    });

    it('fires a MARKET sell when stopLossOrder is "market"', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5', stopLossOrder: 'market'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(95), mockState);
      assertMarketSell(advice);
      expect(advice.amount).toBeNull();
      expect(advice.amountIn).toBe('base');
      expect(advice.reason).toContain('[KILL SWITCH]');
      expect(advice.reason).toContain('Stop-loss');
      expect(advice.reason).toContain('(market)');
      expect(strategy.guardState.killedOrderType).toBe('market');
      // No limit price stored for market orders
      expect(strategy.guardState.killedLimitPrice).toBeNull();
    });

    it('fires a MARKET sell when takeProfitOrder is "market"', async () => {
      const strategy = new TestGuardedStrategy({takeProfitPct: '10', takeProfitOrder: 'market'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const advice = await strategy.onCandle(makeCandle(110), mockState);
      assertMarketSell(advice);
      expect(advice.reason).toContain('Take-profit');
      expect(advice.reason).toContain('(market)');
      expect(strategy.guardState.killedOrderType).toBe('market');
      expect(strategy.guardState.killedLimitPrice).toBeNull();
    });

    it('can mix a market stop-loss with a limit take-profit', async () => {
      const strategy = new TestGuardedStrategy({
        stopLossPct: '5',
        stopLossOrder: 'market',
        takeProfitPct: '10',
        // takeProfitOrder defaults to 'limit'
      });
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const stopAdvice = await strategy.onCandle(makeCandle(95), mockState);
      assertMarketSell(stopAdvice);
    });

    it('can mix a limit stop-loss with a market take-profit', async () => {
      const strategy = new TestGuardedStrategy({
        stopLossPct: '5',
        takeProfitPct: '10',
        takeProfitOrder: 'market',
      });
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      const profitAdvice = await strategy.onCandle(makeCandle(110), mockState);
      assertMarketSell(profitAdvice);
    });

    it('retries market advice on subsequent candles while the position is not exited', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5', stopLossOrder: 'market', signalAdvice: true});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);

      // Fire
      const first = await strategy.onCandle(makeCandle(95), mockState);
      assertMarketSell(first);

      // Retry on next candle — position still 10, should re-emit market sell
      const second = await strategy.onCandle(makeCandle(150), mockState);
      assertMarketSell(second);
      expect(strategy.ownLogicCallCount).toBe(0);
    });

    it('persists killedOrderType across restoreState', async () => {
      const strategy = new TestGuardedStrategy({stopLossPct: '5', stopLossOrder: 'market'});
      await strategy.onFill(makeFill('100', '10', ExchangeOrderSide.BUY), mockState);
      await strategy.onCandle(makeCandle(95), mockState); // fire

      const snapshot = strategy.state;

      const restored = new TestGuardedStrategy({stopLossPct: '5', stopLossOrder: 'market'});
      restored.restoreState(snapshot!);
      expect(restored.guardState.killedOrderType).toBe('market');
      expect(restored.guardState.killedLimitPrice).toBeNull();

      // Retry on restored instance should still be MARKET, not LIMIT
      const advice = await restored.onCandle(makeCandle(50), mockState);
      assertMarketSell(advice);
    });
  });
});
