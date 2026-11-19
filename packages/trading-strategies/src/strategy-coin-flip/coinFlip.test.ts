import {describe, expect, it} from 'vitest';
import {OrderSide} from '@typedtrader/exchange';
import {backtest, flatCandles, flatWithCash} from '../engine/testing.js';
import {CoinFlip} from './coinFlip.js';

describe('CoinFlip', () => {
  it('never places an order the balance cannot cover', async () => {
    /*
     * The class this replaces flipped its coin before looking at the position, so from flat it
     * regularly advised a sell it could not fill. The phase comes from the balance here, so a
     * flip only ever picks between acting and waiting.
     */
    const result = await backtest(new CoinFlip(), flatCandles(200, '100'), flatWithCash);
    const sides = result.trades.map(trade => trade.side);

    expect(result.trades.length, 'two hundred flips produce trades').toBeGreaterThan(0);
    expect(sides[0], 'the first trade can only be the entry').toBe(OrderSide.BUY);
    expect(
      sides.every((side, index) => side === (index % 2 === 0 ? OrderSide.BUY : OrderSide.SELL)),
      'entries and exits alternate, because each one changes which rules apply'
    ).toBe(true);
  });
});
