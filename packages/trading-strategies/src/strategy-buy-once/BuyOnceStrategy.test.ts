import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {ExchangeOrderType} from '@typedtrader/exchange';
import type {ExchangeCandle, ExchangeFeeRate} from '@typedtrader/exchange';
import {TradingPair} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {BuyOnceStrategy} from './BuyOnceStrategy.js';
import {StrategySignal} from '../strategy/StrategySignal.js';
import type {BacktestConfig} from '../backtest/BacktestConfig.js';

const ALPACA_FEES: ExchangeFeeRate = {
  [ExchangeOrderType.MARKET]: new Big(0.0025),
  [ExchangeOrderType.LIMIT]: new Big(0.0015),
};

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

describe('BuyOnceStrategy', () => {
  const tradingPair = new TradingPair('BTC', 'USD');

  it('buys when the close price drops to the target price', async () => {
    const strategy = new BuyOnceStrategy({buyAt: '100'});

    const candles = [
      createCandle({open: '110', close: '110', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // Price drops from 105 through 100 to 95 — target 100 is within [95, 105]
      createCandle({open: '105', close: '95', low: '95', high: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({open: '95', close: '90', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      feeRates: ALPACA_FEES,
      initialBaseBalance: new Big(0),
      initialCounterBalance: new Big(1000),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].advice.signal).toBe(StrategySignal.BUY_LIMIT);
    expect(result.trades[0].price.toFixed(0)).toBe('100');
    expect(result.finalBaseBalance.gt(0)).toBe(true);
  });

  it('does not buy when the price stays above the target', async () => {
    const strategy = new BuyOnceStrategy({buyAt: '50'});

    const candles = [
      createCandle({open: '100', close: '100'}),
      createCandle({open: '90', close: '80'}),
      createCandle({open: '70', close: '60'}),
    ];

    const config: BacktestConfig = {
      candles,
      feeRates: ALPACA_FEES,
      initialBaseBalance: new Big(0),
      initialCounterBalance: new Big(1000),
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
      // Opens at 110, drops through 100 to 80 — target 100 is within [80, 110]
      createCandle({open: '110', close: '80', low: '80', high: '110', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // Also contains 100 in range, but strategy already bought
      createCandle({open: '90', close: '70', low: '70', high: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({open: '80', close: '60', low: '60', high: '105', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      feeRates: ALPACA_FEES,
      initialBaseBalance: new Big(0),
      initialCounterBalance: new Big(1000),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].openTimeInISO).toBe('2025-01-01T00:00:00.000Z');
  });

  it('spends the entire counter balance when amount is null', async () => {
    const strategy = new BuyOnceStrategy({buyAt: '50'});

    const candles = [createCandle({open: '50', close: '50'})];

    const config: BacktestConfig = {
      candles,
      feeRates: ALPACA_FEES,
      initialBaseBalance: new Big(0),
      initialCounterBalance: new Big(1000),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    // Limit fee: 0.15% of 1000 = 1.50, net = 998.50, size = 998.50 / 50 = 19.97
    expect(result.trades[0].size.toFixed(2)).toBe('19.97');
    expect(result.finalCounterBalance.toFixed(2)).toBe('0.00');
  });

  it('executes at the exact predefined price, not the candle close', async () => {
    const strategy = new BuyOnceStrategy({buyAt: '95'});

    const candles = [createCandle({open: '100', close: '90'})];

    const config: BacktestConfig = {
      candles,
      feeRates: ALPACA_FEES,
      initialBaseBalance: new Big(0),
      initialCounterBalance: new Big(1000),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].price.toFixed(0)).toBe('95');
  });
});
