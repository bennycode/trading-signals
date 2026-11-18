import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaBroker, OrderSide, OrderType} from '@typedtrader/exchange';
import {required} from '../engine/index.js';
import {backtest, batched, candlesAt, holdingFromTheStart, tradingPair} from '../engine/testing.js';
import type {TradingSessionState} from '../trader/index.js';
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

  it('attaches at the pivot instead of selling on the candle it arrived on', async () => {
    /*
     * The candle it attaches on ran up to 120 before closing at 100. That high belongs to a time
     * when this strategy held nothing, so taking it as the best price seen would put the target at
     * 108 and sell the position immediately — at the pivot the user named, the target is 90.
     */
    const [attachCandle] = candlesAt(['100']);
    const runUp = batched({...required(attachCandle, 'attach candle'), high: '120'});
    const strategy = new TrailingStop({pivotPrice: '100', trailDownPct: '10'});

    const advice = await strategy.onCandle(runUp, {
      baseBalance: new Big('1'),
      baseBalanceOnHold: new Big(0),
      counterBalance: new Big(0),
      feeRates: {[OrderType.LIMIT]: new Big(0), [OrderType.MARKET]: new Big(0)},
      hasOutstandingBuy: false,
      hasOutstandingSell: false,
      shortBase: new Big(0),
      tradingRules: {...AlpacaBroker.DEFAULT_FRACTIONAL_TRADING_RULES, pair: tradingPair},
    });

    expect(strategy.ledger.bestPrice, 'the anchor is where the position was found, not the run-up').toBe('100');
    expect(advice, 'so a 10% trail sits at 90 and nothing is sold').toBeUndefined();
  });

  it('leaves a balance alone while an order of its own is still working', async () => {
    /*
     * A balance can show a purchase before its fill notification arrives. Adopting it as a
     * position found lying around would count the same purchase again once the fill lands.
     */
    const strategy = new TrailingStop({trailDownPct: '10'});
    const [candle] = candlesAt(['100']);
    const state = (hasOutstandingOrder: boolean): TradingSessionState => ({
      baseBalance: new Big('1'),
      baseBalanceOnHold: new Big(0),
      counterBalance: new Big(0),
      feeRates: {[OrderType.LIMIT]: new Big(0), [OrderType.MARKET]: new Big(0)},
      hasOutstandingBuy: hasOutstandingOrder,
      hasOutstandingSell: false,
      shortBase: new Big(0),
      tradingRules: {...AlpacaBroker.DEFAULT_FRACTIONAL_TRADING_RULES, pair: tradingPair},
    });

    await strategy.onCandle(batched(required(candle, 'candle')), state(true));
    expect(strategy.ledger.size, 'the pending buy will account for it').toBe('0');

    await strategy.onCandle(batched(required(candle, 'candle')), state(false));
    expect(strategy.ledger.size, 'and once no buy is in flight the position is adopted').toBe('1');
  });

  it('guards a holding that already has a sell order resting against it', async () => {
    /*
     * Attaching to a position someone has already offered for sale is the ordinary case for a
     * protective strategy. Waiting for that order to clear would leave the holding unguarded for
     * as long as it rests.
     */
    const strategy = new TrailingStop({trailDownPct: '10'});
    const [candle] = candlesAt(['100']);

    await strategy.onCandle(batched(required(candle, 'candle')), {
      baseBalance: new Big(0),
      baseBalanceOnHold: new Big('1'),
      counterBalance: new Big(0),
      feeRates: {[OrderType.LIMIT]: new Big(0), [OrderType.MARKET]: new Big(0)},
      hasOutstandingBuy: false,
      hasOutstandingSell: true,
      shortBase: new Big(0),
      tradingRules: {...AlpacaBroker.DEFAULT_FRACTIONAL_TRADING_RULES, pair: tradingPair},
    });

    expect(strategy.ledger.size, 'the resting sell holds the position, it does not hide it').toBe('1');
  });

  it('keeps a position whose own sale has not been reported yet', async () => {
    /*
     * A sale can leave the balance before its fill notification arrives. Reading that as "someone
     * else closed it" would lose the price it sold at and could end the session before the fill.
     */
    const strategy = new TrailingStop({trailDownPct: '10'});
    const [attach, after] = candlesAt(['100', '101']);
    const state = (baseBalance: string, hasOutstandingSell: boolean): TradingSessionState => ({
      baseBalance: new Big(baseBalance),
      baseBalanceOnHold: new Big(0),
      counterBalance: new Big(0),
      feeRates: {[OrderType.LIMIT]: new Big(0), [OrderType.MARKET]: new Big(0)},
      hasOutstandingBuy: false,
      hasOutstandingSell,
      shortBase: new Big(0),
      tradingRules: {...AlpacaBroker.DEFAULT_FRACTIONAL_TRADING_RULES, pair: tradingPair},
    });

    await strategy.onCandle(batched(required(attach, 'attach candle')), state('1', false));
    await strategy.onCandle(batched(required(after, 'next candle')), state('0', true));

    expect(strategy.ledger.exits, 'the sale is ours to account for, so no external close is recorded').toBe(0);
  });

  it('measures its thresholds from what is left after a position is partly sold elsewhere', async () => {
    const strategy = new TrailingStop({trailDownPct: '10'});
    const [attach, after] = candlesAt(['100', '100']);
    const state = (baseBalance: string): TradingSessionState => ({
      baseBalance: new Big(baseBalance),
      baseBalanceOnHold: new Big(0),
      counterBalance: new Big(0),
      feeRates: {[OrderType.LIMIT]: new Big(0), [OrderType.MARKET]: new Big(0)},
      hasOutstandingBuy: false,
      hasOutstandingSell: false,
      shortBase: new Big(0),
      tradingRules: {...AlpacaBroker.DEFAULT_FRACTIONAL_TRADING_RULES, pair: tradingPair},
    });

    await strategy.onCandle(batched(required(attach, 'attach candle')), state('10'));
    await strategy.onCandle(batched(required(after, 'next candle')), state('5'));

    expect(strategy.ledger.size, 'half of it is gone, so half of it is what is tracked').toBe('5');
    expect(strategy.ledger.costBasis, 'and what is left still cost what it cost per unit').toBe('500');
  });

  it('leaves a short position alone', async () => {
    const strategy = new TrailingStop({trailDownPct: '10'});
    const [candle] = candlesAt(['100']);
    const messages: string[] = [];
    strategy.onMessage = text => messages.push(text);

    const advice = await strategy.onCandle(batched(required(candle, 'candle')), {
      baseBalance: new Big(0),
      baseBalanceOnHold: new Big(0),
      counterBalance: new Big(0),
      feeRates: {[OrderType.LIMIT]: new Big(0), [OrderType.MARKET]: new Big(0)},
      hasOutstandingBuy: false,
      hasOutstandingSell: false,
      shortBase: new Big('5'),
      tradingRules: {...AlpacaBroker.DEFAULT_FRACTIONAL_TRADING_RULES, pair: tradingPair},
    });

    expect(advice, 'selling to protect a short would enlarge it, so nothing is advised').toBeUndefined();
    expect(strategy.ledger.size, 'and it is not adopted as something to hold').toBe('0');
    expect(messages.join(' '), 'the user is told why nothing happens').toContain('short position');
  });

  it('stops for good when the position it guarded is sold by someone else', async () => {
    /*
     * A position that disappears without the trail firing — sold by hand, rebalanced away — leaves
     * this strategy nothing to guard and no way to buy anything back. It has to finish, or the
     * session stays subscribed and silently attaches the trail to the next position on the pair.
     */
    const strategy = new TrailingStop({trailDownPct: '10'});
    let finishedCount = 0;
    strategy.onFinish = () => {
      finishedCount++;
    };
    const [attachCandle, afterCandle] = candlesAt(['100', '101']);
    const state = (baseBalance: string): TradingSessionState => ({
      baseBalance: new Big(baseBalance),
      baseBalanceOnHold: new Big(0),
      counterBalance: new Big(0),
      feeRates: {[OrderType.LIMIT]: new Big(0), [OrderType.MARKET]: new Big(0)},
      hasOutstandingBuy: false,
      hasOutstandingSell: false,
      shortBase: new Big(0),
      tradingRules: {...AlpacaBroker.DEFAULT_FRACTIONAL_TRADING_RULES, pair: tradingPair},
    });

    await strategy.onCandle(batched(required(attachCandle, 'attach candle')), state('1'));
    await strategy.onCandle(batched(required(afterCandle, 'next candle')), state('0'));

    expect(finishedCount, 'the vanished position ends the strategy as an exit of its own would').toBe(1);
    expect(strategy.ledger.lastExitFinal, 'and it is recorded as terminal, so nothing re-attaches').toBe(true);
  });
});
