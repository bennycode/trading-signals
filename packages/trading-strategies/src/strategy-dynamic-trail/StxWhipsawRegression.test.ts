import Big from 'big.js';
import {uptrendStxCandles} from '@typedtrader/candles';
import {describe, expect, it} from 'vitest';
import {AlpacaBroker, AlpacaBrokerMock, TradingPair} from '@typedtrader/exchange';
import type {Candle} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {TrailingStopStrategy} from '../strategy-trailing-stop/TrailingStopStrategy.js';
import {DynamicTrailStrategy} from './DynamicTrailStrategy.js';
import type {BacktestConfig} from '../backtest/BacktestConfig.js';

/*
 * Regression for the real STX trade. The position was opened on 2026-05-12; this slice starts
 * 2026-04-01 so ATR(14) is warmed by the entry. STX then dipped to a -5.6% intraday shakeout on
 * 2026-05-18 before running on to ~925. A fixed 10% trail (≈1.4x ATR for STX) gets knocked out in
 * that dip; a volatility-sized 3x ATR trail (≈21%) rides through it.
 */
function tradeWindow(): Candle[] {
  const start = uptrendStxCandles.findIndex(candle => candle.openTimeInISO.startsWith('2026-04-01'));
  return uptrendStxCandles.slice(start);
}

function stxExchange() {
  const balances = new Map([
    ['STX', {available: new Big('5'), hold: new Big(0)}],
    ['USD', {available: new Big(0), hold: new Big(0)}],
  ]);
  return new AlpacaBrokerMock({balances, tradingRules: AlpacaBroker.DEFAULT_CRYPTO_TRADING_RULES});
}

describe('STX whipsaw regression', () => {
  const tradingPair = new TradingPair('STX', 'USD');
  const candles = tradeWindow();

  it('DynamicTrailStrategy (3x ATR) rides STX through the May shakeout to the recovery', async () => {
    const strategy = new DynamicTrailStrategy({atrInterval: 14, atrMultiple: '3'});
    const config: BacktestConfig = {broker: stxExchange(), candles, strategy, tradingPair};

    const result = await new BacktestExecutor(config).execute();

    /*
     * The volatility-sized trail (~21%) is never breached by the ~15% dip, so the position is
     * still held when the fixture ends in the recovery at 925.54.
     */
    expect(strategy.trailState.exited).toBe(false);
    expect(result.trades).toHaveLength(0);
    expect(candles[candles.length - 1].close).toBe('925.54');
  });

  it('a fixed 10% trail gets stopped out in the May dip near 754', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});
    const config: BacktestConfig = {broker: stxExchange(), candles, strategy, tradingPair};

    const result = await new BacktestExecutor(config).execute();

    expect(strategy.trailingState.exited).toBe(true);
    expect(result.trades.length).toBeGreaterThanOrEqual(1);

    const exitTarget = parseFloat(strategy.trailingState.exitLimitPrice ?? '0');
    expect(exitTarget).toBeGreaterThan(745);
    expect(exitTarget).toBeLessThan(765);
  });
});
