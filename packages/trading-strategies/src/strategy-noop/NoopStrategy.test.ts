import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {CandleBatcher, OrderType, TradingPair} from '@typedtrader/exchange';
import type {Candle, TradingSessionState} from '@typedtrader/exchange';
import {NoopStrategy} from './NoopStrategy.js';

function createCandle(): Candle {
  return {
    base: 'BTC',
    close: '101',
    counter: 'USD',
    high: '102',
    low: '99',
    open: '100',
    openTimeInISO: '2025-01-01T00:00:00.000Z',
    openTimeInMillis: 1735689600000,
    sizeInMillis: 60000,
    volume: '1',
  };
}

function createState(): TradingSessionState {
  return {
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
      pair: new TradingPair('BTC', 'USD'),
    },
  };
}

describe('NoopStrategy', () => {
  it('returns no advice on any candle', async () => {
    const strategy = new NoopStrategy();
    const state = createState();
    const candle = CandleBatcher.createOneMinuteBatchedCandle([createCandle()]);

    const advice1 = await strategy.onCandle(candle, state);
    const advice2 = await strategy.onCandle(candle, state);

    expect(advice1).toBeUndefined();
    expect(advice2).toBeUndefined();
  });

  it('is discoverable via the strategy registry', async () => {
    const {createStrategy, getStrategyNames} = await import('../strategy/StrategyRegistry.js');

    expect(getStrategyNames()).toContain(NoopStrategy.NAME);
    expect(createStrategy(NoopStrategy.NAME, {})).toBeInstanceOf(NoopStrategy);
  });
});
