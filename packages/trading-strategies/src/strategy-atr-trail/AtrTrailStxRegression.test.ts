import Big from 'big.js';
import {uptrendStxCandles} from '@typedtrader/candles';
import {describe, expect, it} from 'vitest';
import {AlpacaBroker, AlpacaBrokerMock, OrderSide, TradingPair} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {AtrTrailStrategy} from './AtrTrailStrategy.js';

/*
 * Real STX trade. The position is held from 2026-05-12; the ATR trail is sized from the daily
 * history *before* that date, then trails through the 2026-05-18 shakeout (intraday low ~695, a
 * ~17% drop from the 837.62 peak) and on to the ~925 recovery.
 *
 * A tight 2x ATR trail is knocked out in the dip and misses the recovery; the wider 3x ATR trail
 * rides through it. This is the whole reason to size the stop from volatility instead of guessing
 * a fixed percentage.
 */
const pair = new TradingPair('STX', 'USD');
const entryIndex = uptrendStxCandles.findIndex(candle => candle.openTimeInISO.startsWith('2026-05-12'));
const priorHistory = uptrendStxCandles.slice(0, entryIndex);
const tradeWindow = uptrendStxCandles.slice(entryIndex);

function heldStxExchange() {
  const exchange = new AlpacaBrokerMock({
    balances: new Map([
      ['STX', {available: new Big('5'), hold: new Big(0)}],
      ['USD', {available: new Big(0), hold: new Big(0)}],
    ]),
    tradingRules: AlpacaBroker.DEFAULT_CRYPTO_TRADING_RULES,
  });
  // init() pulls these to size the ATR; the backtest reuses the same broker for fills.
  exchange.setHistoricalCandles(priorHistory);
  return exchange;
}

async function runTrail(atrMultiple: string) {
  const strategy = new AtrTrailStrategy({atrInterval: 14, atrMultiple});
  const exchange = heldStxExchange();
  await strategy.init(exchange, pair);
  const result = await new BacktestExecutor({
    broker: exchange,
    candles: tradeWindow,
    strategy,
    tradingPair: pair,
  }).execute();
  return {result, strategy};
}

describe('AtrTrailStrategy on STX', () => {
  it('a tight 2x ATR trail is whipsawed out in the May shakeout', async () => {
    const {result, strategy} = await runTrail('2');

    expect(strategy.trailState.exited, '2x trail is breached and exits').toBe(true);
    const exitPrice = result.trades.find(trade => trade.side === OrderSide.SELL)?.price;
    expect(exitPrice, 'a sell exit fired near the trail target').toBeDefined();
    expect(exitPrice?.toNumber()).toBeGreaterThan(745);
    expect(exitPrice?.toNumber()).toBeLessThan(775);
  });

  it('a wider 3x ATR trail rides the shakeout through to the recovery', async () => {
    const {result, strategy} = await runTrail('3');

    expect(strategy.trailState.exited, '3x trail is never breached').toBe(false);
    expect(result.trades, 'no exit, the position is still held').toHaveLength(0);
    expect(tradeWindow[tradeWindow.length - 1].close).toBe('925.54');
  });

  it('holding via the 3x trail ends richer than getting stopped out at 2x', async () => {
    const tight = await runTrail('2');
    const wide = await runTrail('3');

    expect(
      wide.result.performance.finalPortfolioValue.gt(tight.result.performance.finalPortfolioValue),
      'riding the recovery beats the early stop-out'
    ).toBe(true);
  });
});
