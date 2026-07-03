import Big from 'big.js';
import {describe, expect, it, vi} from 'vitest';
import {OrderSide, OrderType, TradingPair} from '@typedtrader/exchange';
import type {FeeRate, TradingRules} from '@typedtrader/exchange';
import {AdviceExecutor} from './AdviceExecutor.js';
import type {AdviceExecution} from './AdviceExecutor.js';
import {OrderSizeBelowMinimumError} from './OrderSizeBelowMinimumError.js';
import {AllAvailableAmount} from './TradingSessionTypes.js';
import type {OrderAdvice} from './TradingSessionTypes.js';

const pair = new TradingPair('BTC', 'USD');

const tradingRules: TradingRules = {
  base_increment: '0.0001',
  base_max_size: String(Number.MAX_SAFE_INTEGER),
  base_min_size: '0.0001',
  counter_increment: '0.01',
  counter_min_size: '1',
  pair,
};

const feeRates: FeeRate = {
  [OrderType.LIMIT]: new Big(0.0015),
  [OrderType.MARKET]: new Big(0.0025),
};

function createExecutor(options: {baseBalance?: string; counterBalance?: string} = {}) {
  const broker = {
    getAvailableBalances: vi.fn().mockResolvedValue({
      base: new Big(options.baseBalance ?? '10'),
      counter: new Big(options.counterBalance ?? '5000'),
    }),
    placeLimitOrder: vi.fn().mockResolvedValue({
      id: 'limit-1',
      pair,
      price: '100',
      side: OrderSide.BUY,
      size: '1',
      type: OrderType.LIMIT,
    }),
    placeMarketOrder: vi.fn().mockResolvedValue({
      id: 'market-1',
      pair,
      side: OrderSide.BUY,
      size: '1',
      type: OrderType.MARKET,
    }),
  };
  return {broker, executor: new AdviceExecutor({broker, feeRates, pair, tradingRules})};
}

describe('AdviceExecutor', () => {
  it('sells the full base holding when a counter-denominated sell requests all available', async () => {
    const {broker, executor} = createExecutor({baseBalance: '10'});
    const advice: OrderAdvice = {
      amount: AllAvailableAmount,
      amountIn: 'counter',
      side: OrderSide.SELL,
      type: OrderType.MARKET,
    };

    const outcome = await executor.execute(advice);

    expect(outcome.status).toBe('PLACED');
    expect(broker.placeMarketOrder).toHaveBeenCalledWith(pair, {
      side: OrderSide.SELL,
      size: '10',
      sizeInCounter: false,
    });
  });

  it('clamps a notional market buy to the available counter balance', async () => {
    const {broker, executor} = createExecutor({counterBalance: '5000'});
    const advice: OrderAdvice = {
      amount: '6000',
      amountIn: 'counter',
      side: OrderSide.BUY,
      type: OrderType.MARKET,
    };

    const outcome = await executor.execute(advice);

    expect(outcome.status).toBe('PLACED');
    expect(broker.placeMarketOrder).toHaveBeenCalledWith(pair, {
      side: OrderSide.BUY,
      size: '5000',
      sizeInCounter: true,
    });
  });

  it('clamps a limit sell to the available base balance', async () => {
    const {broker, executor} = createExecutor({baseBalance: '3'});
    const advice: OrderAdvice = {
      amount: '100',
      amountIn: 'base',
      price: '250',
      side: OrderSide.SELL,
      type: OrderType.LIMIT,
    };

    const outcome = await executor.execute(advice);

    expect(outcome.status).toBe('PLACED');
    expect(broker.placeLimitOrder).toHaveBeenCalledWith(pair, {
      price: '250',
      side: OrderSide.SELL,
      size: '3',
    });
  });

  it('skips with an OrderSizeBelowMinimumError instead of placing a zero-size order', async () => {
    const {broker, executor} = createExecutor({baseBalance: '0'});
    const advice: OrderAdvice = {
      amount: AllAvailableAmount,
      amountIn: 'base',
      side: OrderSide.SELL,
      type: OrderType.MARKET,
    };

    const outcome = await executor.execute(advice);

    assertSkipped(outcome);
    expect(outcome.error).toBeInstanceOf(OrderSizeBelowMinimumError);
    expect(broker.placeMarketOrder).not.toHaveBeenCalled();
    expect(broker.placeLimitOrder).not.toHaveBeenCalled();
  });

  it('reports broker rejections as skips instead of throwing', async () => {
    const {broker, executor} = createExecutor();
    broker.placeMarketOrder.mockRejectedValue(new Error('Insufficient funds'));
    const advice: OrderAdvice = {
      amount: AllAvailableAmount,
      amountIn: 'counter',
      side: OrderSide.BUY,
      type: OrderType.MARKET,
    };

    const outcome = await executor.execute(advice);

    assertSkipped(outcome);
    expect(outcome.error.message).toBe('Insufficient funds');
    expect(outcome.balances.counter.eq('5000')).toBe(true);
  });
});

function assertSkipped(outcome: AdviceExecution): asserts outcome is Extract<AdviceExecution, {status: 'SKIPPED'}> {
  expect(outcome.status).toBe('SKIPPED');
}
