import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaBroker, OrderSide, OrderType, TradingPair} from '@typedtrader/exchange';
import type {PendingOrder} from '@typedtrader/exchange';
import {sameOrder} from './sameOrder.js';
import {AllAvailableAmount} from './TradingSessionTypes.js';
import type {OrderAdvice} from './TradingSessionTypes.js';

const pair = new TradingPair('BTC', 'USDT');

/** Whole cents and whole hundredths of a coin, so rounding is visible in the numbers. */
const rules = {
  ...AlpacaBroker.DEFAULT_FRACTIONAL_TRADING_RULES,
  base_increment: '0.01',
  counter_increment: '0.01',
  pair,
};

function restingSell(size: string, price = '253.00'): PendingOrder {
  return {id: 'order-1', pair, price, side: OrderSide.SELL, size, type: OrderType.LIMIT};
}

function limitSell(amount: OrderAdvice['amount'], price = '253'): OrderAdvice {
  return {amount, amountIn: 'base', price: new Big(price), side: OrderSide.SELL, type: OrderType.LIMIT};
}

const context = (ownedBase: string) => ({ownedBase: new Big(ownedBase), rules});

describe('sameOrder', () => {
  it('recognises the order a rule is asking for again', () => {
    expect(sameOrder(limitSell('1'), restingSell('1'), context('1'))).toBe(true);
  });

  it('compares the price as the exchange rounded it, not as the rule wrote it', () => {
    expect(
      sameOrder(limitSell('1', '253.129'), restingSell('1', '253.12'), context('1')),
      'the rule asked for a price no exchange accepts, and this is what it became'
    ).toBe(true);
  });

  it('compares the size as the exchange rounded it', () => {
    expect(sameOrder(limitSell('1.009'), restingSell('1'), context('1.009'))).toBe(true);
  });

  it('is a different order at a different price', () => {
    expect(sameOrder(limitSell('1', '260'), restingSell('1'), context('1'))).toBe(false);
  });

  it('is a different order on the other side', () => {
    const buy = {...limitSell('1'), side: OrderSide.BUY};

    expect(sameOrder(buy, restingSell('1'), context('1'))).toBe(false);
  });

  it('is a different order as a market order', () => {
    const atMarket: OrderAdvice = {amount: '1', amountIn: 'base', side: OrderSide.SELL, type: OrderType.MARKET};

    expect(sameOrder(atMarket, restingSell('1'), context('1')), 'a market order names no price at all').toBe(false);
  });

  it('is a different order when the same number means a different currency', () => {
    const inCounter: OrderAdvice = {
      amount: '1',
      amountIn: 'counter',
      side: OrderSide.SELL,
      type: OrderType.MARKET,
    };
    const marketSell: PendingOrder = {id: 'order-2', pair, side: OrderSide.SELL, size: '1', type: OrderType.MARKET};

    expect(sameOrder(inCounter, marketSell, context('1')), 'one is a quantity, the other is an amount of cash').toBe(
      false
    );
  });

  describe('selling everything', () => {
    it('is the same order while the position is still the quantity resting', () => {
      expect(sameOrder(limitSell(AllAvailableAmount), restingSell('1'), context('1'))).toBe(true);
    });

    it('is a different order once the position has grown', () => {
      expect(
        sameOrder(limitSell(AllAvailableAmount), restingSell('1'), context('1.5')),
        'selling everything now means more than the order on the book offers'
      ).toBe(false);
    });

    it('is a different order once the position has shrunk', () => {
      expect(sameOrder(limitSell(AllAvailableAmount), restingSell('1'), context('0.5'))).toBe(false);
    });
  });

  describe('buying with everything', () => {
    const buyAll: OrderAdvice = {
      amount: AllAvailableAmount,
      amountIn: 'base',
      price: new Big('100'),
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
    };
    const restingBuy: PendingOrder = {
      id: 'order-3',
      pair,
      price: '100.00',
      side: OrderSide.BUY,
      size: '5',
      type: OrderType.LIMIT,
    };

    it('is the same order at the same price, whatever the position is', () => {
      expect(
        sameOrder(buyAll, restingBuy, context('0')),
        'the cash it would spend is already held by the order resting on the book'
      ).toBe(true);
    });

    it('is a different order at a different price', () => {
      expect(sameOrder({...buyAll, price: new Big('90')}, restingBuy, context('0'))).toBe(false);
    });
  });
});
