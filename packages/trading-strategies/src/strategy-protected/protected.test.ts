import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {OrderSide, OrderType} from '@typedtrader/exchange';
import type {OrderAdvice} from '../trader/index.js';
import {backtest, candlesAt, holdingFromTheStart} from '../engine/testing.js';
import {createStrategy} from '../strategy/StrategyRegistry.js';
import {Protected} from './protected.js';

/** The price an exit was offered at, which a market order does not name at all. */
function limitPriceOf(advice: OrderAdvice | undefined): string | null {
  return advice && 'price' in advice ? new Big(advice.price).toFixed() : null;
}

describe('Protected', () => {
  it('sells a position it did not open once the stop fires, and buys nothing back', async () => {
    const candles = candlesAt(['100', '100', '90', '100', '100']);

    const result = await backtest(new Protected({stopLossPct: '5'}), candles, holdingFromTheStart);

    expect(
      result.trades.map(trade => trade.side),
      'the strategy has no entry rule, so the stop is the only order it can ever place'
    ).toStrictEqual([OrderSide.SELL]);
  });

  it('stays out of the way when no kill switch is configured', async () => {
    const result = await backtest(new Protected(), candlesAt(['100', '50', '20']), holdingFromTheStart);

    expect(result.trades, 'a threshold nobody set is not an exit at any price').toHaveLength(0);
  });

  it('arms a kill switch that a stored config nests under "protected"', async () => {
    const strategy = createStrategy('@typedtrader/strategy-protected', {protected: {stopLossPct: '5'}});

    const result = await backtest(strategy, candlesAt(['100', '100', '90', '100']), holdingFromTheStart);

    expect(
      result.trades.map(trade => trade.side),
      'a config written before the settings moved to the top level still protects the position'
    ).toStrictEqual([OrderSide.SELL]);
  });

  it('offers exactly the threshold when a stop fires', async () => {
    const result = await backtest(
      new Protected({stopLossPct: '5'}),
      candlesAt(['100', '100', '94', '95', '95']),
      holdingFromTheStart
    );

    expect(result.trades[0]?.advice.type, 'the loss taken is the loss configured').toBe(OrderType.LIMIT);
    expect(limitPriceOf(result.trades[0]?.advice)).toBe('95');
  });

  it('takes whatever the market offers when the config asks for a market stop', async () => {
    /*
     * The price gaps straight through the threshold and never comes back, which is the case a
     * market stop exists for: a limit resting at 95 would still be waiting.
     */
    const result = await backtest(
      new Protected({stopLossOrder: 'market', stopLossPct: '5'}),
      candlesAt(['100', '100', '80', '80']),
      holdingFromTheStart
    );

    expect(result.trades[0]?.advice.type).toBe(OrderType.MARKET);
    expect(limitPriceOf(result.trades[0]?.advice), 'so it names no price of its own').toBeNull();
    expect(result.trades[0]?.price.toFixed(), 'and leaves at what the market offered').toBe('80');
  });

  it('offers exactly the threshold when a take-profit fires', async () => {
    const result = await backtest(
      new Protected({takeProfitPct: '10'}),
      candlesAt(['100', '100', '115', '115']),
      holdingFromTheStart
    );

    expect(result.trades[0]?.advice.type, 'there is nothing to lose by waiting for the price').toBe(OrderType.LIMIT);
    expect(limitPriceOf(result.trades[0]?.advice), 'the profit taken is the profit configured').toBe('110');
  });

  it('leaves a limit stop resting when the market gaps through it', async () => {
    /*
     * The trade-off the default accepts: price never comes back to the threshold, so the order
     * sits there and the position stays held rather than being sold at any price going.
     */
    const result = await backtest(
      new Protected({stopLossPct: '5'}),
      candlesAt(['100', '100', '80', '80', '80']),
      holdingFromTheStart
    );

    expect(result.trades, 'nothing fills above a market that has gapped below it').toHaveLength(0);
  });
});
