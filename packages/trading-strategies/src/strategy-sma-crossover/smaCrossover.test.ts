import {describe, expect, it} from 'vitest';
import {OrderSide} from '@typedtrader/exchange';
import {
  backtest,
  candlesAt,
  flatWithCash,
  holdingFromTheStart,
  loadCandles,
  WEEK_LONG_TIMEOUT,
} from '../engine/testing.js';
import {SmaCrossover} from './smaCrossover.js';

describe('SmaCrossover', () => {
  const candles = loadCandles();

  it(
    'fires at the crossing rather than on every bar on one side of it',
    async () => {
      /*
       * A rule that only compared the current readings would match on every bar the fast average
       * spends above the slow one. Each entry here is therefore separated by an exit.
       */
      const result = await backtest(new SmaCrossover(), candles, flatWithCash);
      const sides = result.trades.map(trade => trade.side);

      expect(sides, 'entries and exits alternate').toStrictEqual(
        sides.map((_, index) => (index % 2 === 0 ? OrderSide.BUY : OrderSide.SELL))
      );
    },
    WEEK_LONG_TIMEOUT
  );

  it('rejects two averages that could never cross', () => {
    expect(
      () => new SmaCrossover({fastPeriod: 10, fastTimeframe: '5m', slowPeriod: 10, slowTimeframe: '5m'}),
      'identical periods on identical bars are the same average'
    ).toThrow();
  });

  it('rejects two averages whose bar sizes are spelled differently but are the same', () => {
    expect(
      () => new SmaCrossover({fastPeriod: 10, fastTimeframe: '1m', slowPeriod: 10, slowTimeframe: '60s'}),
      'a minute is a minute however it is written, so these two averages are one'
    ).toThrow();
  });

  it('stays out while the fast average is already above the slow one', async () => {
    /*
     * The fast average leads the slow one from the very first bar it can be read on, so a rule
     * comparing the current readings would buy immediately. Only the transition counts, and there
     * is none here: the gap never closes.
     */
    const alwaysBullish = await backtest(
      new SmaCrossover({fastPeriod: 2, fastTimeframe: '1m', slowPeriod: 4, slowTimeframe: '1m'}),
      candlesAt(['100', '101', '102', '103', '104', '105', '106', '107']),
      flatWithCash
    );

    expect(alwaysBullish.trades, 'a rising market that never crosses offers nothing to act on').toHaveLength(0);
  });

  it('buys on the candle the fast average crosses above the slow one', async () => {
    /*
     * Falling first, so the fast average starts below the slow one, then rising hard enough to
     * overtake it. That transition is the only thing this strategy acts on.
     */
    const prices = ['110', '108', '106', '104', '102', '100', '104', '112', '120', '128'];

    const result = await backtest(
      new SmaCrossover({fastPeriod: 2, fastTimeframe: '1m', slowPeriod: 4, slowTimeframe: '1m'}),
      candlesAt(prices),
      flatWithCash
    );

    expect(
      result.trades.map(trade => trade.side),
      'one crossing upwards, so one entry and no exit afterwards'
    ).toStrictEqual([OrderSide.BUY]);
    expect(result.trades[0]?.advice.reason, 'the entry names the crossing that caused it').toContain('crossed above');
  });

  it(
    'sells first when it starts out holding',
    async () => {
      const result = await backtest(new SmaCrossover(), candles, holdingFromTheStart);

      expect(result.trades[0]?.side, 'the phase comes from the balance, so a held position can only be closed').toBe(
        OrderSide.SELL
      );
    },
    WEEK_LONG_TIMEOUT
  );
});
