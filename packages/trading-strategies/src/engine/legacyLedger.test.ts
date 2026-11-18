import {describe, expect, it} from 'vitest';
import {BuyOnce} from '../strategy-buy-once/buyOnce.js';
import {backtest, candlesAt, flatWithCash, holdingFromTheStart} from './testing.js';
import {fromLegacyState} from './legacyLedger.js';

/** What the shared base class of the replaced strategies wrote, with a switch that never fired. */
const armed = {
  protected: {
    killed: false,
    killedLimitPrice: null,
    killedOrderType: null,
    killedReason: null,
    totalCostBasis: '500',
    totalPositionSize: '5',
  },
};

describe('fromLegacyState', () => {
  it('keeps the position a kill switch was measured against', () => {
    const ledger = fromLegacyState(armed);

    expect(ledger?.size, 'a threshold per unit divides what the position cost by its size').toBe('5');
    expect(ledger?.costBasis, 'so a 5% stop still fires 5% below what was paid, not below today').toBe('500');
  });

  it('finishes the sale a kill switch had already decided on', () => {
    const ledger = fromLegacyState({
      protected: {...armed.protected, killed: true, killedLimitPrice: '95', killedReason: 'Stop-loss at 95'},
    });

    expect(ledger?.pendingFinalExit, 'the exit is re-placed until the position is gone').toStrictEqual({
      because: 'Stop-loss at 95',
      price: '95',
      quantity: null,
    });
  });

  it('stays finished when the switch fired and the position is already gone', () => {
    const ledger = fromLegacyState({
      protected: {...armed.protected, killed: true, totalCostBasis: '0', totalPositionSize: '0'},
    });

    expect(ledger?.lastExitFinal, 'a stop firing means the reason for holding was wrong, restart or not').toBe(true);
    expect(ledger?.pendingFinalExit, 'and there is nothing left to sell').toBeNull();
  });

  it('carries a ratcheted peak over as the best price seen', () => {
    expect(fromLegacyState({exited: false, peakPrice: '120', stopPrice: '108'})?.bestPrice).toBe('120');
  });

  it('counts a purchase that a one-shot strategy had already made', () => {
    expect(fromLegacyState({bought: true})?.entries, 'buying once means once, across restarts').toBe(1);
  });

  it('is nothing for a snapshot that holds no decision of its own', () => {
    expect(fromLegacyState({}), 'an empty object is not a strategy that did anything').toBeNull();
    expect(fromLegacyState({somethingElse: 1}), 'and neither is a shape from somewhere else').toBeNull();
  });
});

describe('BuyOnce restored from the state of the class it replaces', () => {
  it('does not buy again after the position it bought was sold', async () => {
    const strategy = new BuyOnce();
    strategy.restoreState({bought: true});

    const result = await backtest(strategy, candlesAt(['100', '101', '102']), flatWithCash);

    expect(result.trades, 'the one purchase it is allowed was made before the restart').toHaveLength(0);
  });

  it('still protects the position it is restored onto', async () => {
    const strategy = new BuyOnce({stopLossPct: '5'});
    strategy.restoreState({bought: true, protected: {killed: false, totalCostBasis: '100', totalPositionSize: '1'}});

    // The stop exits at a limit, so the last candle is the one that comes back up to meet it.
    const result = await backtest(strategy, candlesAt(['100', '94', '96']), holdingFromTheStart);

    expect(
      result.trades.map(trade => trade.price.toFixed()),
      'a 5% stop on the 100 it was bought at fires at 94, where a stop re-armed on the restart would not'
    ).toStrictEqual(['96']);
  });
});
