import {describe, expect, it} from 'vitest';
import {OrderSide} from '@typedtrader/exchange';
import {
  backtest,
  flatCandles,
  flatWithCash,
  holdingFromTheStart,
  loadCandles,
  tradeLog,
  ONE_MINUTE_IN_MS,
} from '../engine/testing.js';
import {MeanReversionStrategy} from './MeanReversionStrategy.js';
import {MeanReversion} from './meanReversion.js';

describe('MeanReversion', () => {
  const candles = loadCandles();

  it('trades identically to the class it replaces', async () => {
    const legacy = await backtest(new MeanReversionStrategy({config: {}}), candles, holdingFromTheStart);
    const ported = await backtest(new MeanReversion(), candles, holdingFromTheStart);

    expect(tradeLog(ported), 'the ported rules reproduce the class trade for trade').toStrictEqual(tradeLog(legacy));
    expect(ported.trades.length, 'the week of candles actually produces trades to compare').toBeGreaterThan(0);
  });

  it('opens from flat without needing an unfillable sell first', async () => {
    /*
     * The class flips its phase when it emits advice rather than when the advice fills, so from
     * flat it first tries to sell a position it does not hold, and only buys once that phantom
     * sell has moved it to `waitingForRebuy`. The rules derive the phase from the balance, so the
     * first thing they do is open.
     */
    const legacy = await backtest(new MeanReversionStrategy({config: {}}), candles, flatWithCash);
    const ported = await backtest(new MeanReversion(), candles, flatWithCash);

    expect(ported.trades[0]?.side, 'the rules open the position themselves').toBe(OrderSide.BUY);
    expect(
      ported.trades[0]?.openTimeInISO.localeCompare(legacy.trades[0]?.openTimeInISO ?? ''),
      'the rules enter at the first middle-band touch instead of waiting for an upper-band break'
    ).toBeLessThan(0);
  });

  it('stops out before the bands have warmed up', async () => {
    /*
     * The band rules need twenty hourly bars before they can judge anything. The stop reads only
     * the position, so it does not wait for them.
     */
    const dropped = [...flatCandles(10, '100'), ...flatCandles(10, '98', 10 * ONE_MINUTE_IN_MS)];

    const result = await backtest(new MeanReversion({stopLossPct: '1'}), dropped, holdingFromTheStart);

    expect(result.trades, 'the stop fires during warm-up').toHaveLength(1);
    expect(result.trades[0]?.advice.reason, 'and it is the stop that fired').toContain('Stop-loss');
  });

  it('stops out and then stays flat for good', async () => {
    // Twenty hourly bars of warm-up at 100, then a drop past the 1% stop.
    const warmUp = flatCandles(20 * 60, '100');
    const drop = flatCandles(60, '98', 20 * 60 * ONE_MINUTE_IN_MS);
    const strategy = new MeanReversion({stopLossPct: '1'});
    let finishedCount = 0;
    strategy.onFinish = () => {
      finishedCount++;
    };

    const result = await backtest(strategy, [...warmUp, ...drop], holdingFromTheStart);

    expect(result.trades, 'the stop sells once and nothing is bought back').toHaveLength(1);
    expect(result.trades[0]?.side).toBe(OrderSide.SELL);
    expect(result.trades[0]?.advice.reason, 'the stop-loss rule is the one that fired').toContain('Stop-loss');
    expect(strategy.ledger.lastExitFinal, 'the exit is recorded as terminal').toBe(true);
    expect(finishedCount, 'the runtime is told to tear the session down once').toBe(1);
  });
});
