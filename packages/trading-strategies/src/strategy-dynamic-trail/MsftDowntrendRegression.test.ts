import Big from 'big.js';
import {downtrendMsftCandles} from '@typedtrader/candles';
import {describe, expect, it} from 'vitest';
import {AlpacaBroker, AlpacaBrokerMock, TradingPair} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {TrailingStopStrategy} from '../strategy-trailing-stop/TrailingStopStrategy.js';
import {DynamicTrailStrategy} from './DynamicTrailStrategy.js';
import type {BacktestConfig} from '../backtest/BacktestConfig.js';

/*
 * Companion to the STX shakeout regression — the other half of the adaptivity story. MSFT sells
 * off from 485.63 to 430.04 (-11.4% buy & hold) on an hourly series. Because hourly ATR% is small,
 * the SAME `atrMultiple: 3` that produced a wide ~21% trail on STX (daily) becomes a tight ~2%
 * trail here, so DynamicTrailStrategy stops out early near the top and caps the loss. A fixed 10%
 * trail is far too wide for the hourly noise and never protects.
 */
const candles = downtrendMsftCandles;
const entry = parseFloat(candles[0].close);
const buyAndHoldPct = (parseFloat(candles[candles.length - 1].close) / entry - 1) * 100;

function msftExchange() {
  const balances = new Map([
    ['MSFT', {available: new Big('1'), hold: new Big(0)}],
    ['USD', {available: new Big(0), hold: new Big(0)}],
  ]);
  return new AlpacaBrokerMock({balances, tradingRules: AlpacaBroker.DEFAULT_CRYPTO_TRADING_RULES});
}

describe('MSFT downtrend regression', () => {
  const tradingPair = new TradingPair('MSFT', 'USD');

  it('DynamicTrailStrategy (3x ATR) stops out near the top, far better than buy & hold', async () => {
    const strategy = new DynamicTrailStrategy({atrInterval: 14, atrMultiple: '3'});
    const config: BacktestConfig = {broker: msftExchange(), candles, strategy, tradingPair};

    const result = await new BacktestExecutor(config).execute();

    expect(strategy.trailState.exited).toBe(true);
    expect(result.trades.length).toBeGreaterThanOrEqual(1);

    // Exits near the top (~477), nowhere near the 430 trough.
    const exitPrice = parseFloat(result.trades[0].price.toString());
    expect(exitPrice).toBeGreaterThan(470);
    expect(exitPrice).toBeLessThan(485);

    // The volatility-sized trail caps the loss to a small fraction of the -11.4% buy & hold.
    const exitPct = (exitPrice / entry - 1) * 100;
    expect(exitPct).toBeGreaterThan(-5);
    expect(exitPct).toBeGreaterThan(buyAndHoldPct + 5);
  });

  it('a fixed 10% trail is too wide for the hourly series and never protects', async () => {
    const strategy = new TrailingStopStrategy({trailDownPct: '10'});
    const config: BacktestConfig = {broker: msftExchange(), candles, strategy, tradingPair};

    const result = await new BacktestExecutor(config).execute();

    expect(strategy.trailingState.exited).toBe(false);
    expect(result.trades).toHaveLength(0);
  });
});
