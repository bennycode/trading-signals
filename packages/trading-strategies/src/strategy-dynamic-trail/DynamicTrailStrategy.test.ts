import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaBroker, AlpacaBrokerMock, OrderSide, TradingPair} from '@typedtrader/exchange';
import type {Candle} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {ChandelierTrailStrategy} from './ChandelierTrailStrategy.js';
import {DynamicTrailStrategy} from './DynamicTrailStrategy.js';
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

function createMockExchange(baseBalance = '5') {
  const balances = new Map([
    ['BTC', {available: new Big(baseBalance), hold: new Big(0)}],
    ['USD', {available: new Big(0), hold: new Big(0)}],
  ]);
  return new AlpacaBrokerMock({balances, tradingRules: AlpacaBroker.DEFAULT_CRYPTO_TRADING_RULES});
}

function minuteCandles(closes: readonly {close: string; high: string; low: string}[]): Candle[] {
  return closes.map((bar, index) =>
    createCandle({
      close: bar.close,
      high: bar.high,
      low: bar.low,
      open: bar.close,
      openTimeInISO: new Date(Date.UTC(2025, 0, 1, 0, index)).toISOString(),
    })
  );
}

describe('DynamicTrailStrategy', () => {
  const tradingPair = new TradingPair('BTC', 'USD');

  it('sizes the trail from volatility and exits when the close breaches it', async () => {
    /*
     * Market exit so the breach fills on the following candle (a sell-limit at the trail target
     * would need price to trade back up to it, which a downward breach never does).
     */
    const strategy = new DynamicTrailStrategy({
      atrInterval: 2,
      atrMultiple: '3',
      exitOrder: 'market',
      fallbackTrailDownPct: '10',
    });

    // Steady ~2-wide bars warm the ATR, then a sharp drop breaches; the final bar fills the exit.
    const candles = minuteCandles([
      {close: '100', high: '101', low: '99'},
      {close: '101', high: '102', low: '100'},
      {close: '102', high: '103', low: '101'},
      {close: '88', high: '89', low: '87'},
      {close: '88', high: '89', low: '87'},
    ]);

    const config: BacktestConfig = {broker: createMockExchange(), candles, strategy, tradingPair};
    const result = await new BacktestExecutor(config).execute();

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].advice.side).toBe(OrderSide.SELL);
    expect(strategy.trailState.exited).toBe(true);
  });

  it('does not lower the stop once set (ratcheting)', async () => {
    const strategy = new DynamicTrailStrategy({atrInterval: 2, atrMultiple: '3', fallbackTrailDownPct: '5'});

    /*
     * Peak set at 100, stop established. Then a volatility spike (wide bar) — the ratcheting stop
     * must not move down to accommodate it.
     */
    const candles = minuteCandles([
      {close: '100', high: '100', low: '100'},
      {close: '99', high: '100', low: '98'},
      {close: '99', high: '100', low: '80'},
    ]);

    const config: BacktestConfig = {broker: createMockExchange(), candles, strategy, tradingPair};
    await new BacktestExecutor(config).execute();

    const stopAfterSpike = new Big(strategy.trailState.stopPrice);
    const firstSizedStop = new Big(100).mul(0.95); // peak 100, fallback 5% before ATR warms

    expect(stopAfterSpike.gte(firstSizedStop)).toBe(true);
  });

  it('registers a different stop than the adaptive variant after a volatility spike', async () => {
    const candles = minuteCandles([
      {close: '100', high: '100', low: '100'},
      {close: '100', high: '100', low: '99'},
      {close: '100', high: '100', low: '70'}, // ATR(2) jumps → wide trail
    ]);

    const ratchet = new DynamicTrailStrategy({atrInterval: 2, atrMultiple: '3', fallbackTrailDownPct: '5'});
    const adaptive = new ChandelierTrailStrategy({atrInterval: 2, atrMultiple: '3', fallbackTrailDownPct: '5'});

    await new BacktestExecutor({broker: createMockExchange(), candles, strategy: ratchet, tradingPair}).execute();
    await new BacktestExecutor({broker: createMockExchange(), candles, strategy: adaptive, tradingPair}).execute();

    /*
     * Same peak (100), but the adaptive stop widens DOWN with the volatility spike while the
     * ratcheting stop holds its higher level.
     */
    expect(new Big(adaptive.trailState.stopPrice).lt(ratchet.trailState.stopPrice)).toBe(true);
  });
});
