import {describe, expect, it} from 'vitest';
import {OrderSide} from '@typedtrader/exchange';
import {backtest, flatWithCash, holdingFromTheStart, loadCandles, tradeLog} from '../engine/testing.js';
import {SmaCrossoverStrategy} from './SmaCrossoverStrategy.js';
import {SmaCrossover} from './smaCrossover.js';

describe('SmaCrossover', () => {
  const candles = loadCandles();

  it('trades identically to the class it replaces', async () => {
    const legacy = await backtest(new SmaCrossoverStrategy(), candles, flatWithCash);
    const ported = await backtest(new SmaCrossover(), candles, flatWithCash);

    expect(tradeLog(ported), 'the ported rules reproduce the class trade for trade').toStrictEqual(tradeLog(legacy));
    expect(ported.trades.length, 'the week of candles actually produces crossings to compare').toBeGreaterThan(0);
  });

  it('fires at the crossing rather than on every bar on one side of it', async () => {
    /*
     * A rule that only compared the current readings would match on every bar the fast average
     * spends above the slow one. Each entry here is therefore separated by an exit.
     */
    const result = await backtest(new SmaCrossover(), candles, flatWithCash);
    const sides = result.trades.map(trade => trade.side);

    expect(sides, 'entries and exits alternate').toStrictEqual(
      sides.map((_, index) => (index % 2 === 0 ? OrderSide.BUY : OrderSide.SELL))
    );
  });

  it('rejects two averages that could never cross', () => {
    expect(
      () => new SmaCrossover({fastPeriod: 10, fastTimeframe: '5m', slowPeriod: 10, slowTimeframe: '5m'}),
      'identical periods on identical bars are the same average'
    ).toThrow();
  });

  it('sells first when it starts out holding', async () => {
    const result = await backtest(new SmaCrossover(), candles, holdingFromTheStart);

    expect(result.trades[0]?.side, 'the phase comes from the balance, so a held position can only be closed').toBe(
      OrderSide.SELL
    );
  });
});
