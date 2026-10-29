import Big from 'big.js';
import {uptrendStxCandles} from '@typedtrader/candles';
import {describe, expect, it} from 'vitest';
import {AlpacaBroker, AlpacaBrokerMock, OrderSide, TradingPair} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {TrailingStopStrategy} from './TrailingStopStrategy.js';

/*
 * A real STX trade, ported from the AtrTrailStrategy proposal so its evidence outlives the two
 * implementations being merged into one. The position is held from 2026-05-12; the trail is sized
 * from the daily history before that date, then trails through the 2026-05-18 shakeout (intraday
 * low 695.42, some 17% off the 837.62 peak) and on to the 925.54 close.
 *
 * This is the argument for sizing a stop from volatility instead of guessing a percentage, and it
 * is also what makes the thresholds in ATR_TRAIL_BANDS more than folklore: on this window the
 * tight trails are all knocked out within days of each other and never see the recovery, while
 * 3x rides through it. The bounds below are deliberately loose enough to describe the behaviour
 * rather than one implementation's arithmetic.
 */
const pair = new TradingPair('STX', 'USD');
const entryIndex = uptrendStxCandles.findIndex(candle => candle.openTimeInISO.startsWith('2026-05-12'));
const priorHistory = uptrendStxCandles.slice(0, entryIndex);
const tradeWindow = uptrendStxCandles.slice(entryIndex);

async function runTrail(atrMultiple: string) {
  const strategy = new TrailingStopStrategy(
    {atrInterval: '1d', atrMultiple, atrPeriod: 14},
    // The ATR is sized from the days before the entry; the broker only has to fill the exit.
    {fetchCandles: async () => priorHistory}
  );
  const result = await new BacktestExecutor({
    broker: new AlpacaBrokerMock({
      balances: new Map([
        ['STX', {available: new Big('5'), hold: new Big(0)}],
        ['USD', {available: new Big(0), hold: new Big(0)}],
      ]),
      tradingRules: AlpacaBroker.DEFAULT_CRYPTO_TRADING_RULES,
    }),
    candles: tradeWindow,
    strategy,
    tradingPair: pair,
  }).execute();
  return {result, strategy};
}

describe('TrailingStopStrategy on real STX candles', {concurrent: false}, () => {
  it('sizes the trail from history rather than from the trade window', async () => {
    const {strategy} = await runTrail('3');

    expect(priorHistory.length, 'enough daily bars precede the entry to stabilise a 14-period ATR').toBeGreaterThan(14);
    expect(strategy.trailingState.peakPrice, 'the peak ratchets to the window high').toBe('966.21');
  });

  it('a tight 2x ATR trail is whipsawed out in the May shakeout', async () => {
    const {result, strategy} = await runTrail('2');

    expect(strategy.trailingState.exited, 'the 2x trail is breached and exits').toBe(true);
    const exitPrice = result.trades.find(trade => trade.side === OrderSide.SELL)?.price;
    expect(exitPrice, 'a sell exit fired near the trail target').toBeDefined();
    expect(exitPrice?.toNumber()).toBeGreaterThan(745);
    expect(exitPrice?.toNumber()).toBeLessThan(775);
  });

  it('a wider 3x ATR trail rides the shakeout through to the recovery', async () => {
    const {result, strategy} = await runTrail('3');

    expect(strategy.trailingState.exited, 'the 3x trail is never breached').toBe(false);
    expect(result.trades, 'no exit, the position is still held').toHaveLength(0);
    expect(tradeWindow.at(-1)?.close, 'the window ends on the recovery it would have missed').toBe('925.54');
  });

  it('holding via the 3x trail ends richer than getting stopped out at 2x', async () => {
    const tight = await runTrail('2');
    const wide = await runTrail('3');

    expect(
      wide.result.performance.finalPortfolioValue.gt(tight.result.performance.finalPortfolioValue),
      'riding the recovery beats the early stop-out'
    ).toBe(true);
    expect(
      wide.result.performance.finalPortfolioValue.minus(tight.result.performance.finalPortfolioValue).toNumber(),
      'and by enough to matter, not by rounding'
    ).toBeGreaterThan(500);
  });

  it('every multiple below the whipsaw band is knocked out of this window', async () => {
    for (const atrMultiple of ['1.5', '2', '2.5']) {
      const {strategy} = await runTrail(atrMultiple);
      expect(strategy.trailingState.exited, `${atrMultiple}x is too tight for this instrument`).toBe(true);
    }
  });
});
