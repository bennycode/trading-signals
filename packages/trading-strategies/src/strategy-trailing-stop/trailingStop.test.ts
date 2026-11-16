import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {OrderSide, OrderType} from '@typedtrader/exchange';
import {backtest, candlesAt, holdingFromTheStart} from '../engine/testing.js';
import {TrailingStop} from './trailingStop.js';

describe('TrailingStop', () => {
  it('sells once price falls the configured percentage from the anchor', async () => {
    // Anchored at 100, a 10% trail puts the target at 90, so the candle at 89 is the exit.
    const candles = candlesAt(['100', '95', '91', '89', '89']);

    const result = await backtest(
      new TrailingStop({exitOrder: 'market', trailDownPct: '10'}),
      candles,
      holdingFromTheStart
    );

    expect(result.trades, 'the trail fires once and has nothing left to do').toHaveLength(1);
    expect(result.trades[0]?.side).toBe(OrderSide.SELL);
    expect(result.trades[0]?.price.toFixed(), 'it leaves on the candle that breached the target').toBe('89');
  });

  it('raises the anchor with the price and never lowers it again', async () => {
    /*
     * The anchor moves 100 → 120, which moves the target 90 → 108. The closing 107 is therefore an
     * exit although it is well above the target the first candle alone would have set.
     */
    const candles = candlesAt(['100', '120', '107', '107']);
    const config = {exitOrder: 'market', trailDownPct: '10'} as const;

    const ratcheted = await backtest(new TrailingStop(config), candles, holdingFromTheStart);
    const neverRose = await backtest(
      new TrailingStop(config),
      candlesAt(['100', '100', '107', '107']),
      holdingFromTheStart
    );

    expect(ratcheted.trades, 'the raised anchor turns 107 into a breach').toHaveLength(1);
    expect(neverRose.trades, 'without the higher high the same price is still a hold').toHaveLength(0);
  });

  it('anchors on the configured pivot rather than the candle it attached to', async () => {
    // The attach candle's high is 160, but a pivot of 200 puts the target at 180 instead of 144.
    const candles = candlesAt(['160', '179']);

    const pinned = await backtest(
      new TrailingStop({exitOrder: 'market', pivotPrice: '200', trailDownPct: '10'}),
      candles,
      holdingFromTheStart
    );
    const unpinned = await backtest(
      new TrailingStop({exitOrder: 'market', trailDownPct: '10'}),
      candles,
      holdingFromTheStart
    );

    expect(pinned.trades, 'the pivot is far enough above the price to be breached at once').toHaveLength(1);
    expect(unpinned.trades, 'anchored on the attach candle the same price is a hold').toHaveLength(0);
  });

  it('offers the trail target as a limit price', async () => {
    // Breached at 89, so the order offers the target of 90 and fills when price returns to it.
    const candles = candlesAt(['100', '89', '95']);

    const result = await backtest(new TrailingStop({trailDownPct: '10'}), candles, holdingFromTheStart);

    const [trade] = result.trades;
    expect(trade?.advice.type, 'a limit exit is the default').toBe(OrderType.LIMIT);
    expect(
      trade?.advice.type === OrderType.LIMIT ? new Big(trade.advice.price).toFixed() : null,
      'it asks for the target, not the price that breached it'
    ).toBe('90');
  });

  it('stops for good once the trail has fired', async () => {
    const strategy = new TrailingStop({exitOrder: 'market', trailDownPct: '10'});
    let finishedCount = 0;
    strategy.onFinish = () => {
      finishedCount++;
    };

    const result = await backtest(strategy, candlesAt(['100', '89', '200', '300']), holdingFromTheStart);

    expect(result.trades, 'the rally that follows buys nothing back').toHaveLength(1);
    expect(strategy.ledger.lastExitFinal, 'the exit is recorded as terminal').toBe(true);
    expect(finishedCount, 'the runtime is told to tear the session down once').toBe(1);
  });
});
