import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {OrderSide, OrderType} from '@typedtrader/exchange';
import type {OrderAdvice} from '../trader/index.js';
import {backtest, candlesAt, flatCandles, flatWithCash} from '../engine/testing.js';
import {BuyOnce} from './buyOnce.js';

/** The price an order was offered at, which is not the price it ended up filling at. */
function limitPriceOf(advice: OrderAdvice | undefined): string | undefined {
  return advice && 'price' in advice ? new Big(advice.price).toFixed() : undefined;
}

describe('BuyOnce', () => {
  it('buys at market on the first candle and then stays quiet', async () => {
    const result = await backtest(new BuyOnce(), flatCandles(50, '100'), flatWithCash);

    expect(result.trades, 'one entry, however many candles follow').toHaveLength(1);
    expect(result.trades[0]?.side).toBe(OrderSide.BUY);
    expect(result.trades[0]?.advice.type).toBe(OrderType.MARKET);
  });

  it('waits for its limit price', async () => {
    const result = await backtest(new BuyOnce({buyAt: '90'}), candlesAt(['100', '95', '88', '80']), flatWithCash);

    expect(result.trades, 'nothing is bought above the limit').toHaveLength(1);
    expect(result.trades[0]?.advice.type).toBe(OrderType.LIMIT);
    expect(limitPriceOf(result.trades[0]?.advice), 'the order is offered at the configured price').toBe('90');
  });

  it('buys the configured quantity', async () => {
    const result = await backtest(new BuyOnce({quantity: '0.25'}), flatCandles(5, '100'), flatWithCash);

    expect(result.trades[0]?.size.toFixed(), 'the share count comes from the config').toBe('0.25');
  });

  it('spends the configured amount', async () => {
    const result = await backtest(new BuyOnce({spend: '1000'}), flatCandles(5, '100'), flatWithCash);

    expect(
      result.trades[0]?.size.toNumber(),
      'a thousand of counter currency at 100 buys ten, less the fee'
    ).toBeCloseTo(10, 1);
  });

  it('does not buy back in after a stop-loss', async () => {
    const candles = candlesAt(['100', '100', '80', '100', '100']);

    const result = await backtest(new BuyOnce({stopLossPct: '10'}), candles, flatWithCash);

    expect(
      result.trades.map(trade => trade.side),
      'the entry, then the stop, and nothing after it'
    ).toStrictEqual([OrderSide.BUY, OrderSide.SELL]);
  });

  it('stops out a loss named in counter currency, scaled by how much is held', async () => {
    const candles = candlesAt(['100', '100', '100', '94', '94']);

    const result = await backtest(new BuyOnce({quantity: '10', stopLossNominal: '50'}), candles, flatWithCash);

    expect(
      result.trades[1]?.advice.reason,
      'a 50 loss spread over ten shares is 5 off the entry price, so the exit sits at 95'
    ).toContain('<= 95');
  });

  it('takes profit at a price it was told outright', async () => {
    const candles = candlesAt(['100', '100', '111', '111']);

    const result = await backtest(new BuyOnce({quantity: '10', takeProfitPrice: '110'}), candles, flatWithCash);

    expect(result.trades[1]?.advice.reason, 'the target is the price itself, not a distance from the entry').toContain(
      '>= 110'
    );
  });

  it('refuses two ways of saying where the same exit goes', () => {
    expect(() => new BuyOnce({stopLossNominal: '50', stopLossPct: '5'})).toThrow(/stopLossPct and stopLossNominal/);
  });
});
