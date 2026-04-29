import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaExchangeMock, ExchangeOrderSide, ExchangeOrderType, TradingPair} from '@typedtrader/exchange';
import type {ExchangeCandle} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {TrailingStopStrategy} from './TrailingStopStrategy.js';
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
    ['BTC', {available: new Big(options.baseBalance ?? '5'), hold: new Big(0)}],
    ['USD', {available: new Big(options.counterBalance ?? '0'), hold: new Big(0)}],
  ]);
  return new AlpacaExchangeMock({balances});
}

describe('TrailingStopStrategy', () => {
  const tradingPair = new TradingPair('BTC', 'USD');

  it('attaches on the first candle and exits with a limit sell at the trail target by default', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    // C1: attach at close=100. peak=100.
    // C2: high=120 → peak ratchets to 120. close=118 > 108 → no exit.
    // C3: high=120, close=107 → 107 <= 108 → exit fires (limit sell at 108).
    // C4: limit sell fills (low=105 <= 108).
    const candles = [
      createCandle({open: '100', close: '100', low: '99', high: '101', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({open: '105', close: '118', low: '104', high: '120', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({open: '118', close: '107', low: '106', high: '120', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      createCandle({open: '107', close: '107', low: '105', high: '108', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange({baseBalance: '5'}),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].advice.side).toBe(ExchangeOrderSide.SELL);
    expect(result.trades[0].advice.type).toBe(ExchangeOrderType.LIMIT);
    expect(strategy.trailingState.exited).toBe(true);
    expect(strategy.trailingState.exitLimitPrice).toBe('108');
  });

  it('does not exit while price stays above the trail target', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '5'});

    // peak ratchets up; close never breaches peak * 0.95.
    const candles = [
      createCandle({open: '100', close: '100', low: '99', high: '101', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({open: '101', close: '105', low: '100', high: '106', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({open: '105', close: '110', low: '104', high: '112', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      createCandle({open: '110', close: '108', low: '107', high: '112', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange({baseBalance: '5'}),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(0);
    expect(strategy.trailingState.exited).toBe(false);
    expect(new Big(strategy.trailingState.peakPrice).gte(new Big('110'))).toBe(true);
  });

  it('peak only ratchets upward — a lower high after a higher one does not lower the trail', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    const candles = [
      createCandle({open: '100', close: '100', low: '99', high: '101', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({open: '105', close: '115', low: '104', high: '120', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({open: '115', close: '110', low: '110', high: '116', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      createCandle({open: '110', close: '107', low: '107', high: '111', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
      createCandle({open: '107', close: '107', low: '105', high: '108', openTimeInISO: '2025-01-01T00:04:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange({baseBalance: '5'}),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(strategy.trailingState.peakPrice).toBe('120');
    expect(strategy.trailingState.exited).toBe(true);
  });

  it('uses a market sell when exitOrder is "market"', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10', exitOrder: 'market'});

    const candles = [
      createCandle({open: '100', close: '100', low: '99', high: '101', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({open: '105', close: '118', low: '104', high: '120', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({open: '118', close: '107', low: '106', high: '120', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      createCandle({open: '107', close: '107', low: '105', high: '108', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange({baseBalance: '5'}),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].advice.type).toBe(ExchangeOrderType.MARKET);
    expect(strategy.trailingState.exitLimitPrice).toBeNull();
  });

  it('waits to attach until the base balance is non-zero', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    // Empty balance → no attach, no advice.
    const candles = [
      createCandle({open: '100', close: '100', low: '99', high: '101', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({open: '100', close: '100', low: '99', high: '101', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange({baseBalance: '0', counterBalance: '0'}),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(0);
    expect(strategy.trailingState.peakPrice).toBe('0');
  });

  it('seeds the peak from the attach candle high, not from its close', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    const candles = [
      // Attach: high=160 (intra-candle high), close=150. Peak=160 (from high). Target=144.
      createCandle({open: '150', close: '150', low: '149', high: '160', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // close=143 <= 144 → exit fires. high=150 doesn't ratchet peak above 160.
      createCandle({open: '150', close: '143', low: '140', high: '150', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      // Limit fills (low=140 <= 144).
      createCandle({open: '143', close: '143', low: '140', high: '145', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange({baseBalance: '5'}),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(strategy.trailingState.peakPrice).toBe('160');
    expect(strategy.trailingState.exitLimitPrice).toBe('144');
  });

  it('seeds the peak from a configured pivotPrice instead of the attach candle high', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10', pivotPrice: '200'});

    const candles = [
      // Attach candle high=160, but pivotPrice=200 wins. Peak=200, target=180.
      createCandle({open: '150', close: '150', low: '149', high: '160', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // close=179 <= 180 → exit fires at limit 180. high=150 doesn't ratchet peak.
      createCandle({open: '150', close: '179', low: '178', high: '150', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      // Limit fills (low=178 <= 180).
      createCandle({open: '179', close: '179', low: '178', high: '181', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange({baseBalance: '5'}),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(strategy.trailingState.peakPrice).toBe('200');
    expect(strategy.trailingState.exitLimitPrice).toBe('180');
  });

  it('only ratchets the peak when a new high exceeds it by trailUpPct', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10', trailUpPct: '5'});

    const candles = [
      // Attach. peak=100, ratchet threshold=105 (peak * 1.05).
      createCandle({open: '100', close: '100', low: '99', high: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // high=104 < 105 → does NOT ratchet. Peak stays at 100.
      createCandle({open: '100', close: '102', low: '99', high: '104', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      // high=110 >= 105 → ratchets. Peak jumps to 110. New threshold=115.5.
      createCandle({open: '102', close: '108', low: '101', high: '110', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      // high=114 < 115.5 → does NOT ratchet. Peak stays at 110.
      createCandle({open: '108', close: '112', low: '107', high: '114', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
      // close=98 <= 99 (110 * 0.9) → exit fires at limit 99.
      createCandle({open: '112', close: '98', low: '97', high: '113', openTimeInISO: '2025-01-01T00:04:00.000Z'}),
      // Limit fills (low=97 <= 99).
      createCandle({open: '98', close: '98', low: '97', high: '100', openTimeInISO: '2025-01-01T00:05:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange({baseBalance: '5'}),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(strategy.trailingState.peakPrice).toBe('110');
    expect(strategy.trailingState.exitLimitPrice).toBe('99');
  });

  it('defaults trailDownPct to 10 when omitted', async () => {
    const strategy = new TrailingStopStrategy({});

    const candles = [
      // Attach: peak=100. Default 10% trail → target=90.
      createCandle({open: '100', close: '100', low: '99', high: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // close=90 <= 90 → exit fires at limit 90.
      createCandle({open: '100', close: '90', low: '89', high: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      // Limit fills (low=89 <= 90).
      createCandle({open: '90', close: '90', low: '89', high: '91', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      candles,
      exchange: createMockExchange({baseBalance: '5'}),
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(strategy.trailingState.exitLimitPrice).toBe('90');
  });

  it('rejects malformed restored state that would strand the strategy in a no-op', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    // peak set but no position and not exited → permanent no-op. Predicate rejects;
    // the proxied state stays at defaults so the strategy can still attach.
    strategy.restoreState({
      exited: false,
      positionSize: '0',
      peakPrice: '120',
      exitReason: null,
      exitLimitPrice: null,
    });

    expect(strategy.trailingState.peakPrice).toBe('0');
    expect(strategy.trailingState.positionSize).toBe('0');
  });

  it('rejects restored state where exited=true but positionSize is non-zero', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    strategy.restoreState({
      exited: true,
      positionSize: '5',
      peakPrice: '120',
      exitReason: null,
      exitLimitPrice: null,
    });

    expect(strategy.trailingState.exited).toBe(false);
    expect(strategy.trailingState.positionSize).toBe('0');
  });

  it('restores state and resumes trailing without re-attaching', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    strategy.restoreState({
      exited: false,
      positionSize: '5',
      peakPrice: '120',
      exitReason: null,
      exitLimitPrice: null,
    });

    expect(strategy.trailingState.peakPrice).toBe('120');
    expect(strategy.trailingState.positionSize).toBe('5');
  });
});
