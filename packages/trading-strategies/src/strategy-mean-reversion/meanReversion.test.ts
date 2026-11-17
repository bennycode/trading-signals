import {describe, expect, it} from 'vitest';
import {OrderSide} from '@typedtrader/exchange';
import {
  backtest,
  flatCandles,
  flatWithCash,
  holdingFromTheStart,
  loadCandles,
  ONE_MINUTE_IN_MS,
  WEEK_LONG_TIMEOUT,
} from '../engine/testing.js';
import {MeanReversion} from './meanReversion.js';

describe('MeanReversion', () => {
  const candles = loadCandles();

  it(
    'opens from flat rather than trying to sell what it does not hold',
    async () => {
      const result = await backtest(new MeanReversion(), candles, flatWithCash);

      expect(result.trades[0]?.side, 'the phase comes from the balance, so from flat there is nothing to close').toBe(
        OrderSide.BUY
      );
    },
    WEEK_LONG_TIMEOUT
  );

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
