import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaBrokerMock, CandleBatcher, OrderSide, OrderType} from '@typedtrader/exchange';
import type {Candle} from '@typedtrader/exchange';
import type {TradingSessionState} from '../trader/index.js';
import {TradingPair} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {BuyOnceStrategy} from './BuyOnceStrategy.js';
import type {BacktestConfig} from '../backtest/BacktestConfig.js';

function createCandle(overrides: Partial<Candle> & {close: string; open: string}): Candle {
  const openNum = parseFloat(overrides.open);
  const closeNum = parseFloat(overrides.close);

  return {
    base: 'BTC',
    close: overrides.close,
    counter: 'USD',
    high: overrides.high ?? String(Math.max(openNum, closeNum)),
    low: overrides.low ?? String(Math.min(openNum, closeNum)),
    open: overrides.open,
    openTimeInISO: overrides.openTimeInISO ?? '2025-01-01T00:00:00.000Z',
    openTimeInMillis: overrides.openTimeInMillis ?? 1735689600000,
    sizeInMillis: overrides.sizeInMillis ?? 60000,
    volume: overrides.volume ?? '100',
  };
}

function createMockExchange(options: {baseBalance?: string; counterBalance?: string} = {}) {
  const balances = new Map([
    ['BTC', {available: new Big(options.baseBalance ?? '0'), hold: new Big(0)}],
    ['USD', {available: new Big(options.counterBalance ?? '1000'), hold: new Big(0)}],
  ]);
  return new AlpacaBrokerMock({balances});
}

describe('BuyOnceStrategy', () => {
  const tradingPair = new TradingPair('BTC', 'USD');

  it('buys when the close price drops to the target price (with 1-candle delay)', async () => {
    const strategy = new BuyOnceStrategy({buyAt: '100'});

    const candles = [
      createCandle({close: '110', high: '112', low: '108', open: '110', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // Price drops through 100 — target is within [95, 105]
      createCandle({close: '95', high: '105', low: '95', open: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      // Order fills on this candle
      createCandle({close: '90', high: '102', low: '88', open: '98', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange(),
      candles,
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].advice.side).toBe(OrderSide.BUY);
    expect(result.trades[0].advice.type).toBe(OrderType.LIMIT);
    expect(result.finalBaseBalance.gt(0)).toBe(true);
  });

  it('does not buy when the price stays above the target', async () => {
    const strategy = new BuyOnceStrategy({buyAt: '50'});

    const candles = [
      createCandle({close: '100', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({close: '80', open: '90', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({close: '60', open: '70', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange(),
      candles,
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(0);
    expect(result.finalCounterBalance.toFixed(2)).toBe('1000.00');
  });

  it('only triggers once even when multiple candles are below the target', async () => {
    const strategy = new BuyOnceStrategy({buyAt: '100'});

    const candles = [
      // Close at 80, below 100 — advice triggers
      createCandle({close: '80', high: '110', low: '80', open: '110', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // Fill happens here, strategy already bought so no new advice
      createCandle({close: '70', high: '105', low: '70', open: '90', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({close: '60', high: '105', low: '60', open: '80', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange(),
      candles,
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
  });

  it('spends the entire counter balance when amount is null', async () => {
    const strategy = new BuyOnceStrategy({buyAt: '50'});

    /*
     * Candle 1: close=50 → advice triggers (limit buy at 50)
     * Candle 2: order fills
     */
    const candles = [
      createCandle({close: '50', high: '52', low: '48', open: '50', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({close: '50', high: '52', low: '48', open: '50', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange(),
      candles,
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(result.finalBaseBalance.gt(0)).toBe(true);
    // Most of the counter should be spent
    expect(result.finalCounterBalance.lt(new Big(100))).toBe(true);
  });

  it('executes at the predefined limit price when it is reachable', async () => {
    const strategy = new BuyOnceStrategy({buyAt: '95'});

    /*
     * Candle 1: close=90 < 95, advice triggers (limit buy at 95)
     * Candle 2: low=88 <= 95, order fills. Open=92 < 95, so price improvement: fills at 92
     */
    const candles = [
      createCandle({close: '90', high: '102', low: '88', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({close: '88', high: '96', low: '85', open: '92', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange(),
      candles,
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    // With price improvement, fills at the better open price of 92
    expect(parseFloat(result.trades[0].price.toFixed(0))).toBeLessThanOrEqual(95);
  });

  it('does not re-buy after restoreState({bought: true})', async () => {
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
        pair: tradingPair,
      },
    };

    const strategy = new BuyOnceStrategy({buyAt: '100'});
    strategy.restoreState({bought: true});

    // Close price is below buyAt — would normally trigger a buy, but state is restored as already bought
    const candle = createCandle({close: '80', open: '80', openTimeInISO: '2025-01-01T00:00:00.000Z'});
    const advice = await strategy.onCandle(CandleBatcher.createOneMinuteBatchedCandle([candle]), mockState);

    expect(advice).toBeUndefined();
  });
});
