import {describe, expect, it} from 'vitest';
import {OrderSide} from '@typedtrader/exchange';
import {backtest, candlesAt, dailyCandles, flatWithCash, holdingFromTheStart, tradeLog} from '../engine/testing.js';
import {Scalp} from './scalp.js';

/** The live candles start here, so the daily history has to close before it. */
const START = Date.UTC(2025, 1, 1);

/**
 * Thirty days that end where they started, which is the market this strategy is made for: a
 * month of movement that went nowhere reads as range-bound however wide the swings were.
 */
const RANGING = dailyCandles(
  Array.from({length: 30}, (_, day) => String(100 + Math.abs(5 - (day % 10)))),
  START
);

/** Thirty days of one-way movement, where every scalp sells something that keeps rising. */
const TRENDING = dailyCandles(
  Array.from({length: 30}, (_, day) => String(100 + day * 2)),
  START
);

describe('Scalp', () => {
  it('sells each entry an offset above its fill and buys back an offset below the exit', async () => {
    // EMA(3) sits at 100 after three flat candles, so the candle at 105 is the entry.
    const candles = candlesAt(['100', '100', '100', '105', '105', '106', '105', '105'], START);

    const result = await backtest(new Scalp({emaPeriod: 3, offset: '1'}), candles, flatWithCash, RANGING);

    expect(
      tradeLog(result).map(trade => trade.replace(/ [\d.]+ @ /, ' @ ')),
      'a full round trip and the next entry'
    ).toStrictEqual(['BUY @ 105', 'SELL @ 106', 'BUY @ 105']);
  });

  it('refuses an instrument that is trending rather than ranging', async () => {
    const candles = candlesAt(['100', '100', '100', '105', '105', '106', '106'], START);
    const config = {emaPeriod: 3, offset: '1'} as const;

    const trending = await backtest(new Scalp(config), candles, flatWithCash, TRENDING);
    const ranging = await backtest(new Scalp(config), candles, flatWithCash, RANGING);

    expect(trending.trades, 'a one-way market is no place to scalp').toHaveLength(0);
    expect(ranging.trades.length, 'the same candles on a ranging instrument do trade').toBeGreaterThan(0);
  });

  it('derives the offset from the instrument when none is configured', async () => {
    const candles = candlesAt(['100', '100', '100', '105', '105', '110', '110'], START);

    const withHistory = await backtest(new Scalp({emaPeriod: 3}), candles, flatWithCash, RANGING);
    const withoutHistory = await backtest(new Scalp({emaPeriod: 3}), candles, flatWithCash);

    expect(withHistory.trades.length, 'the daily range is enough to price both legs').toBeGreaterThan(0);
    expect(
      withoutHistory.trades,
      'with neither a configured nor a derivable offset there is no price to offer'
    ).toHaveLength(0);
  });

  it('waits an offset below its exit to re-enter, even for a position it adopted', async () => {
    /*
     * A position the strategy did not open leaves no entry behind, so phasing on the entry count
     * would send it back to the EMA rule after that position is sold — which buys at market, into
     * a price that has already run away, instead of waiting an offset below the exit.
     */
    const candles = candlesAt(['100', '101', '102', '103'], START);

    const result = await backtest(new Scalp({emaPeriod: 2, offset: '1'}), candles, holdingFromTheStart, RANGING);

    expect(
      result.trades.map(trade => trade.side),
      'the adopted position is sold, and the re-entry rests below the exit instead of chasing'
    ).toStrictEqual([OrderSide.SELL]);
  });

  it('stops scalping for good once the stop-loss fires', async () => {
    const strategy = new Scalp({emaPeriod: 3, offset: '1', stopLossPct: '5'});
    const candles = candlesAt(['100', '100', '94', '94', '200', '200'], START);

    const result = await backtest(strategy, candles, holdingFromTheStart, RANGING);

    expect(result.trades, 'the stop sells and the rally that follows is not scalped').toHaveLength(1);
    expect(result.trades[0]?.advice.reason, 'the stop-loss rule is the one that fired').toContain('Stop-loss');
    expect(strategy.ledger.lastExitFinal, 'the exit is recorded as terminal').toBe(true);
  });
});
