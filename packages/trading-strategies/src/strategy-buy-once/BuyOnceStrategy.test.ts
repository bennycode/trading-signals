import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaExchangeMock} from '@typedtrader/exchange';
import type {ExchangeCandle} from '@typedtrader/exchange';
import {TradingPair} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {BuyOnceStrategy} from './BuyOnceStrategy.js';
import {StrategySignal} from '../strategy/StrategySignal.js';
import type {BacktestConfig} from '../backtest/BacktestConfig.js';

function createCandle(overrides: Partial<ExchangeCandle> & {close: string; open: string}): ExchangeCandle {
  const openNum = parseFloat(overrides.open);
  const closeNum = parseFloat(overrides.close);

  return {
    base: 'BTC',
    counter: 'USD',
    high: overrides.high ?? String(Math.max(openNum, closeNum)),
    low: overrides.low ?? String(Math.min(openNum, closeNum)),
    open: overrides.open,
    close: overrides.close,
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
  return new AlpacaExchangeMock({balances});
}

describe('BuyOnceStrategy', () => {
  const tradingPair = new TradingPair('BTC', 'USD');

  it('buys when the close price drops to the target price (with 1-candle delay)', async () => {
    const strategy = new BuyOnceStrategy({buyAt: '100'});

    const candles = [
      createCandle({open: '110', close: '110', low: '108', high: '112', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // Price drops through 100 — target is within [95, 105]
      createCandle({open: '105', close: '95', low: '95', high: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      // Order fills on this candle
      createCandle({open: '98', close: '90', low: '88', high: '102', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange(),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].advice.signal).toBe(StrategySignal.BUY_LIMIT);
    expect(result.finalBaseBalance.gt(0)).toBe(true);
  });

  it('does not buy when the price stays above the target', async () => {
    const strategy = new BuyOnceStrategy({buyAt: '50'});

    const candles = [
      createCandle({open: '100', close: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({open: '90', close: '80', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({open: '70', close: '60', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange(),
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
      createCandle({open: '110', close: '80', low: '80', high: '110', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // Fill happens here, strategy already bought so no new advice
      createCandle({open: '90', close: '70', low: '70', high: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({open: '80', close: '60', low: '60', high: '105', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange(),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
  });

  it('spends the entire counter balance when amount is null', async () => {
    const strategy = new BuyOnceStrategy({buyAt: '50'});

    // Candle 1: close=50 → advice triggers (limit buy at 50)
    // Candle 2: order fills
    const candles = [
      createCandle({open: '50', close: '50', low: '48', high: '52', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({open: '50', close: '50', low: '48', high: '52', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange(),
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

    // Candle 1: close=90 < 95, advice triggers (limit buy at 95)
    // Candle 2: low=88 <= 95, order fills. Open=92 < 95, so price improvement: fills at 92
    const candles = [
      createCandle({open: '100', close: '90', low: '88', high: '102', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({open: '92', close: '88', low: '85', high: '96', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange(),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    // With price improvement, fills at the better open price of 92
    expect(parseFloat(result.trades[0].price.toFixed(0))).toBeLessThanOrEqual(95);
  });
});
