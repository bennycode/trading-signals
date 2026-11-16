import {describe, expect, it} from 'vitest';
import {OrderSide, OrderType} from '@typedtrader/exchange';
import {backtest, candlesAt, flatWithCash, holdingFromTheStart} from '../engine/testing.js';
import {BuyBelowSellAbove} from './buyBelowSellAbove.js';

describe('BuyBelowSellAbove', () => {
  it('buys under the floor and sells over the ceiling', async () => {
    // A limit order fills on a later candle, so each threshold is crossed for two candles here.
    const candles = candlesAt(['100', '89', '88', '120', '121']);
    const strategy = new BuyBelowSellAbove({buyBelow: '90', sellAbove: '110'});

    const result = await backtest(strategy, candles, flatWithCash);

    expect(
      result.trades.map(trade => `${trade.side} @ ${trade.price.toFixed()}`),
      'it enters on the candle below the floor and leaves on the one above the ceiling'
    ).toStrictEqual([`${OrderSide.BUY} @ 88`, `${OrderSide.SELL} @ 121`]);
    expect(result.trades[0]?.advice.type, 'both orders are limits at the price that decided them').toBe(
      OrderType.LIMIT
    );
  });

  it('does nothing while the price sits between the two', async () => {
    const strategy = new BuyBelowSellAbove({buyBelow: '90', sellAbove: '110'});

    const result = await backtest(strategy, candlesAt(['100', '95', '105', '100']), flatWithCash);

    expect(result.trades, 'neither threshold is crossed').toHaveLength(0);
  });

  it('holds on without a ceiling to sell at', async () => {
    const strategy = new BuyBelowSellAbove({buyBelow: '90'});

    const result = await backtest(strategy, candlesAt(['89', '88', '200', '300']), flatWithCash);

    expect(result.trades, 'the position is bought and never sold').toHaveLength(1);
    expect(result.trades[0]?.side).toBe(OrderSide.BUY);
  });

  it('stops out of a position it did not open', async () => {
    const strategy = new BuyBelowSellAbove({sellAbove: '110', stopLossPct: '5'});

    const result = await backtest(strategy, candlesAt(['100', '100', '90', '90']), holdingFromTheStart);

    expect(result.trades, 'the stop applies to the balance the strategy attached to').toHaveLength(1);
    expect(result.trades[0]?.advice.reason, 'the stop-loss rule is the one that fired').toContain('Stop-loss');
  });
});
