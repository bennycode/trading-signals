import {describe, expect, it} from 'vitest';
import {OrderSide} from '@typedtrader/exchange';
import {backtest, candlesAt, holdingFromTheStart} from '../engine/testing.js';
import {createStrategy} from '../strategy/StrategyRegistry.js';
import {Protected} from './protected.js';

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
});
