import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaBrokerMock, OrderSide, OrderType, TradingPair} from '@typedtrader/exchange';
import type {Candle} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {TrailingStopStrategy} from './TrailingStopStrategy.js';
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
    ['BTC', {available: new Big(options.baseBalance ?? '5'), hold: new Big(0)}],
    ['USD', {available: new Big(options.counterBalance ?? '0'), hold: new Big(0)}],
  ]);
  return new AlpacaBrokerMock({balances});
}

describe('TrailingStopStrategy', () => {
  const tradingPair = new TradingPair('BTC', 'USD');

  it('attaches on the first candle and exits with a limit sell at the trail target by default', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    /*
     * C1: attach at close=100. peak=100.
     * C2: high=120 → peak ratchets to 120. close=118 > 108 → no exit.
     * C3: high=120, close=107 → 107 <= 108 → exit fires (limit sell at 108).
     * C4: limit sell fills (low=105 <= 108).
     */
    const candles = [
      createCandle({close: '100', high: '101', low: '99', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({close: '118', high: '120', low: '104', open: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({close: '107', high: '120', low: '106', open: '118', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      createCandle({close: '107', high: '108', low: '105', open: '107', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '5'}),
      candles,
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].advice.side).toBe(OrderSide.SELL);
    expect(result.trades[0].advice.type).toBe(OrderType.LIMIT);
    expect(strategy.trailingState.exited).toBe(true);
    expect(strategy.trailingState.exitLimitPrice).toBe('108');
  });

  it('does not exit while price stays above the trail target', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '5'});

    // peak ratchets up; close never breaches peak * 0.95.
    const candles = [
      createCandle({close: '100', high: '101', low: '99', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({close: '105', high: '106', low: '100', open: '101', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({close: '110', high: '112', low: '104', open: '105', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      createCandle({close: '108', high: '112', low: '107', open: '110', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '5'}),
      candles,
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
      createCandle({close: '100', high: '101', low: '99', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({close: '115', high: '120', low: '104', open: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({close: '110', high: '116', low: '110', open: '115', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      createCandle({close: '107', high: '111', low: '107', open: '110', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
      createCandle({close: '107', high: '108', low: '105', open: '107', openTimeInISO: '2025-01-01T00:04:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '5'}),
      candles,
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(strategy.trailingState.peakPrice).toBe('120');
    expect(strategy.trailingState.exited).toBe(true);
  });

  it('uses a market sell when exitOrder is "market"', async () => {
    const strategy = new TrailingStopStrategy({exitOrder: 'market', trailDownPct: '10'});

    const candles = [
      createCandle({close: '100', high: '101', low: '99', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({close: '118', high: '120', low: '104', open: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      createCandle({close: '107', high: '120', low: '106', open: '118', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      createCandle({close: '107', high: '108', low: '105', open: '107', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '5'}),
      candles,
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].advice.type).toBe(OrderType.MARKET);
    expect(strategy.trailingState.exitLimitPrice).toBeNull();
  });

  it('waits to attach until the base balance is non-zero', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    // Empty balance → no attach, no advice.
    const candles = [
      createCandle({close: '100', high: '101', low: '99', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      createCandle({close: '100', high: '101', low: '99', open: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '0', counterBalance: '0'}),
      candles,
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
      createCandle({close: '150', high: '160', low: '149', open: '150', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // close=143 <= 144 → exit fires. high=150 doesn't ratchet peak above 160.
      createCandle({close: '143', high: '150', low: '140', open: '150', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      // Limit fills (low=140 <= 144).
      createCandle({close: '143', high: '145', low: '140', open: '143', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '5'}),
      candles,
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(strategy.trailingState.peakPrice).toBe('160');
    expect(strategy.trailingState.exitLimitPrice).toBe('144');
  });

  it('seeds the peak from a configured pivotPrice instead of the attach candle high', async () => {
    const strategy = new TrailingStopStrategy({pivotPrice: '200', trailDownPct: '10'});

    const candles = [
      // Attach candle high=160, but pivotPrice=200 wins. Peak=200, target=180.
      createCandle({close: '150', high: '160', low: '149', open: '150', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // close=179 <= 180 → exit fires at limit 180. high=150 doesn't ratchet peak.
      createCandle({close: '179', high: '150', low: '178', open: '150', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      // Limit fills (low=178 <= 180).
      createCandle({close: '179', high: '181', low: '178', open: '179', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '5'}),
      candles,
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
      createCandle({close: '100', high: '100', low: '99', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // high=104 < 105 → does NOT ratchet. Peak stays at 100.
      createCandle({close: '102', high: '104', low: '99', open: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      // high=110 >= 105 → ratchets. Peak jumps to 110. New threshold=115.5.
      createCandle({close: '108', high: '110', low: '101', open: '102', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      // high=114 < 115.5 → does NOT ratchet. Peak stays at 110.
      createCandle({close: '112', high: '114', low: '107', open: '108', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
      // close=98 <= 99 (110 * 0.9) → exit fires at limit 99.
      createCandle({close: '98', high: '113', low: '97', open: '112', openTimeInISO: '2025-01-01T00:04:00.000Z'}),
      // Limit fills (low=97 <= 99).
      createCandle({close: '98', high: '100', low: '97', open: '98', openTimeInISO: '2025-01-01T00:05:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '5'}),
      candles,
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
      createCandle({close: '100', high: '100', low: '99', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // close=90 <= 90 → exit fires at limit 90.
      createCandle({close: '90', high: '100', low: '89', open: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      // Limit fills (low=89 <= 90).
      createCandle({close: '90', high: '91', low: '89', open: '90', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '5'}),
      candles,
      strategy,
      tradingPair,
    };

    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(strategy.trailingState.exitLimitPrice).toBe('90');
  });

  it('rejects malformed restored state that would strand the strategy in a no-op', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    /*
     * peak set but no position and not exited → permanent no-op. Predicate rejects;
     * the proxied state stays at defaults so the strategy can still attach.
     */
    strategy.restoreState({
      exited: false,
      exitLimitPrice: null,
      exitReason: null,
      peakPrice: '120',
      positionSize: '0',
      stopPrice: '108',
    });

    expect(strategy.trailingState.peakPrice).toBe('0');
    expect(strategy.trailingState.positionSize).toBe('0');
  });

  it('rejects restored state where exited=true but positionSize is non-zero', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    strategy.restoreState({
      exited: true,
      exitLimitPrice: null,
      exitReason: null,
      peakPrice: '120',
      positionSize: '5',
      stopPrice: '108',
    });

    expect(strategy.trailingState.exited).toBe(false);
    expect(strategy.trailingState.positionSize).toBe('0');
  });

  it('exposes stopPrice in state from the moment the strategy attaches', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    const candles = [
      // Attach: peak=100. stopPrice should be 90.
      createCandle({close: '100', high: '100', low: '99', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // Peak ratchets to 120. stopPrice should refresh to 108.
      createCandle({close: '115', high: '120', low: '100', open: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '5'}),
      candles,
      strategy,
      tradingPair,
    };

    await new BacktestExecutor(config).execute();

    expect(strategy.trailingState.peakPrice).toBe('120');
    expect(strategy.trailingState.stopPrice).toBe('108');
  });

  it('emits an onMessage on attach with the peak and stop target', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});
    const messages: string[] = [];
    strategy.onMessage = text => messages.push(text);

    const candles = [
      createCandle({close: '100', high: '100', low: '99', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '5'}),
      candles,
      strategy,
      tradingPair,
    };

    await new BacktestExecutor(config).execute();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toBe('Trail attached. Peak: 100, stop: 90 (-10%)');
  });

  it('emits an onMessage on every peak ratchet with the new peak and stop target', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});
    const messages: string[] = [];
    strategy.onMessage = text => messages.push(text);

    const candles = [
      // Attach: peak=100. attach message.
      createCandle({close: '100', high: '100', low: '99', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // high=120 → ratchet. peak=120, stop=108.
      createCandle({close: '115', high: '120', low: '100', open: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      // high=120 (no new peak). No ratchet message.
      createCandle({close: '118', high: '120', low: '115', open: '115', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      // high=130 → ratchet. peak=130, stop=117.
      createCandle({close: '125', high: '130', low: '119', open: '120', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '5'}),
      candles,
      strategy,
      tradingPair,
    };

    await new BacktestExecutor(config).execute();

    expect(messages).toEqual([
      'Trail attached. Peak: 100, stop: 90 (-10%)',
      'Peak moved to 120 (stop: 108)',
      'Peak moved to 130 (stop: 117)',
    ]);
  });

  it('emits a single onMessage when the trail first breaches and not on re-emissions', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});
    const messages: string[] = [];
    strategy.onMessage = text => messages.push(text);

    const candles = [
      // Attach: peak=100. target=90. (Emits attach message.)
      createCandle({close: '100', high: '100', low: '99', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
      // close=90 <= 90 → first breach, fires message + emits limit advice.
      createCandle({close: '90', high: '100', low: '89', open: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      // close=85 <= 90, advice re-emitted but message must NOT fire again.
      createCandle({close: '85', high: '90', low: '84', open: '90', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      // Limit fills (low=84 <= 90).
      createCandle({close: '85', high: '86', low: '84', open: '85', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
    ];

    const config: BacktestConfig = {
      broker: createMockExchange({baseBalance: '5'}),
      candles,
      strategy,
      tradingPair,
    };

    await new BacktestExecutor(config).execute();

    expect(messages).toHaveLength(2);
    expect(messages[0]).toBe('Trail attached. Peak: 100, stop: 90 (-10%)');
    expect(messages[1]).toMatch(/^Trailing stop: close 90 <= peak 100/);
  });

  it('restores state and resumes trailing without re-attaching', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});

    strategy.restoreState({
      exited: false,
      exitLimitPrice: null,
      exitReason: null,
      peakPrice: '120',
      positionSize: '5',
      stopPrice: '108',
    });

    expect(strategy.trailingState.peakPrice).toBe('120');
    expect(strategy.trailingState.stopPrice).toBe('108');
    expect(strategy.trailingState.positionSize).toBe('5');
  });
});
