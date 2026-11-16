import {describe, expect, it} from 'vitest';
import {OrderSide, OrderType, TradingPair} from '@typedtrader/exchange';
import type {PendingOrder} from '@typedtrader/exchange';
import {baseOnHold} from './baseOnHold.js';

const pair = new TradingPair('BTC', 'USDT');

function limitOrder(side: OrderSide, size: string): PendingOrder {
  return {id: `${side}-${size}`, pair, price: '100', side, size, type: OrderType.LIMIT};
}

describe('baseOnHold', () => {
  it('adds up what unfilled sells are holding', () => {
    const orders = [limitOrder(OrderSide.SELL, '2'), limitOrder(OrderSide.SELL, '0.5')];

    expect(baseOnHold(orders).toFixed(), 'both offers are still owned').toBe('2.5');
  });

  it('ignores a buy, which holds cash rather than the position', () => {
    expect(baseOnHold([limitOrder(OrderSide.BUY, '3')]).toFixed()).toBe('0');
  });

  it('ignores a sell whose size is an amount of cash to raise', () => {
    const order: PendingOrder = {
      id: 'notional',
      pair,
      side: OrderSide.SELL,
      size: '200',
      sizeInCounter: true,
      type: OrderType.MARKET,
    };

    expect(baseOnHold([order]).toFixed(), '"get me 200 USDT" names no quantity to count').toBe('0');
  });

  it('is nothing at all without open orders', () => {
    expect(baseOnHold([]).toFixed()).toBe('0');
  });
});
