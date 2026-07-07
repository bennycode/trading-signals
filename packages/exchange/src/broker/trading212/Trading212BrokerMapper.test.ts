import {describe, expect, it} from 'vitest';
import {OrderPosition, OrderSide, OrderType} from '../Broker.js';
import {TradingPair} from '../TradingPair.js';
import type {HistoryOrder} from './api/schema/HistoryOrderSchema.js';
import {Trading212OrderStatus, type Order} from './api/schema/OrderSchema.js';
import {Trading212Broker} from './Trading212Broker.js';
import {Trading212BrokerMapper} from './Trading212BrokerMapper.js';

const pair = new TradingPair('AAPL_US_EQ', 'USD');

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 101,
    limitPrice: 155.5,
    quantity: 2,
    status: Trading212OrderStatus.NEW,
    strategy: 'QUANTITY',
    ticker: 'AAPL_US_EQ',
    type: 'LIMIT',
    ...overrides,
  };
}

describe('Trading212Broker.toMarketDataPair', () => {
  it('strips the country and asset-type suffix from a vendor ticker', () => {
    const marketDataPair = Trading212Broker.toMarketDataPair(new TradingPair('AAPL_US_EQ', 'USD'));
    expect(marketDataPair.base).toBe('AAPL');
    expect(marketDataPair.counter).toBe('USD');
  });

  it('joins intra-symbol underscores with dots so class shares match data-provider conventions', () => {
    const marketDataPair = Trading212Broker.toMarketDataPair(new TradingPair('BRK_B_US_EQ', 'USD'));
    expect(marketDataPair.base).toBe('BRK.B');
    expect(marketDataPair.counter).toBe('USD');
  });

  it('leaves tickers without a vendor suffix untouched', () => {
    const marketDataPair = Trading212Broker.toMarketDataPair(new TradingPair('AAPL', 'USD'));
    expect(marketDataPair.base).toBe('AAPL');
  });
});

describe('Trading212BrokerMapper', () => {
  describe('toPendingOrder', () => {
    it('maps a LIMIT BUY order', () => {
      const order = createOrder();

      const pendingOrder = Trading212BrokerMapper.toPendingOrder(order, pair, {
        price: '155.5',
        side: OrderSide.BUY,
        size: '2',
        sizeInCounter: false,
        type: OrderType.LIMIT,
      });

      expect(pendingOrder).toEqual({
        id: '101',
        pair,
        price: '155.5',
        side: OrderSide.BUY,
        size: '2',
        type: OrderType.LIMIT,
      });
    });

    it('maps a MARKET SELL order whose sign-encoded quantity is negative to an unsigned size', () => {
      const order = createOrder({limitPrice: null, quantity: -3, type: 'MARKET'});

      const pendingOrder = Trading212BrokerMapper.toPendingOrder(order, pair, {
        side: OrderSide.SELL,
        size: '3',
        sizeInCounter: true,
        type: OrderType.MARKET,
      });

      expect(pendingOrder).toEqual({
        id: '101',
        pair,
        side: OrderSide.SELL,
        size: '3',
        type: OrderType.MARKET,
      });
    });

    it('throws when Trading212 returns an order without a quantity', () => {
      const order = createOrder({quantity: null});

      expect(() =>
        Trading212BrokerMapper.toPendingOrder(order, pair, {
          price: '155.5',
          side: OrderSide.BUY,
          size: '2',
          sizeInCounter: false,
          type: OrderType.LIMIT,
        })
      ).toThrowError('Trading212 returned an order without a quantity (id: 101).');
    });

    it('throws when a LIMIT order comes back without a limitPrice', () => {
      const order = createOrder({limitPrice: null});

      expect(() =>
        Trading212BrokerMapper.toPendingOrder(order, pair, {
          price: '155.5',
          side: OrderSide.BUY,
          size: '2',
          sizeInCounter: false,
          type: OrderType.LIMIT,
        })
      ).toThrowError('Trading212 returned a LIMIT order without a limitPrice (id: 101).');
    });
  });

  describe('toOpenOrder', () => {
    it('derives BUY from a positive quantity on a LIMIT order', () => {
      const order = createOrder({limitPrice: 150, quantity: 2});

      expect(Trading212BrokerMapper.toOpenOrder(order, pair)).toEqual({
        id: '101',
        pair,
        price: '150',
        side: OrderSide.BUY,
        size: '2',
        type: OrderType.LIMIT,
      });
    });

    it('derives SELL from a negative quantity on a MARKET order', () => {
      const order = createOrder({quantity: -7, type: 'MARKET'});

      expect(Trading212BrokerMapper.toOpenOrder(order, pair)).toEqual({
        id: '101',
        pair,
        side: OrderSide.SELL,
        size: '7',
        type: OrderType.MARKET,
      });
    });

    it('throws when the order has no quantity (VALUE-strategy orders must be filtered by the caller)', () => {
      const order = createOrder({quantity: null, value: 100});

      expect(() => Trading212BrokerMapper.toOpenOrder(order, pair)).toThrowError(
        'Trading212 returned an order without a quantity (id: 101).'
      );
    });

    it('throws when a LIMIT order has no limitPrice', () => {
      const order = createOrder({limitPrice: null});

      expect(() => Trading212BrokerMapper.toOpenOrder(order, pair)).toThrowError(
        'Trading212 returned a LIMIT order without a limitPrice (id: 101).'
      );
    });
  });

  describe('toFilledOrder', () => {
    it('maps a filled BUY order and nets the debit tax lines into a fee in the account currency', () => {
      const item: HistoryOrder = {
        fill: {
          filledAt: '2025-06-02T14:30:01.000Z',
          price: 100.5,
          quantity: 2,
          walletImpact: {
            taxes: [
              {name: 'CURRENCY_CONVERSION_FEE', quantity: -0.5},
              {name: 'FRENCH_TRANSACTION_TAX', quantity: -0.25},
            ],
          },
        },
        order: {
          createdAt: '2025-06-02T14:30:00.000Z',
          id: 7,
          quantity: 2,
          status: Trading212OrderStatus.FILLED,
          ticker: 'AAPL_US_EQ',
        },
      };

      const fill = Trading212BrokerMapper.toFilledOrder(item, pair, 'EUR');

      expect(fill).toEqual({
        created_at: '2025-06-02T14:30:01.000Z',
        fee: '0.75',
        feeAsset: 'EUR',
        order_id: '7',
        pair,
        position: OrderPosition.LONG,
        price: '100.5',
        side: OrderSide.BUY,
        size: '2',
      });
    });

    it('subtracts credit/rebate tax lines from the fee instead of inflating it', () => {
      const item: HistoryOrder = {
        fill: {
          filledAt: '2025-06-02T14:30:01.000Z',
          price: 100.5,
          quantity: 2,
          walletImpact: {
            taxes: [
              {name: 'CURRENCY_CONVERSION_FEE', quantity: -0.5},
              {name: 'CURRENCY_CONVERSION_FEE_REBATE', quantity: 0.2},
            ],
          },
        },
        order: {id: 12, quantity: 2, status: Trading212OrderStatus.FILLED, ticker: 'AAPL_US_EQ'},
      };

      const fill = Trading212BrokerMapper.toFilledOrder(item, pair, 'EUR');

      expect(fill.fee).toBe('0.3');
    });

    it('clamps a net tax credit to a zero fee because neutral Fill.fee is an additive cost', () => {
      const item: HistoryOrder = {
        fill: {
          filledAt: '2025-06-02T14:30:01.000Z',
          price: 100.5,
          quantity: 2,
          walletImpact: {taxes: [{name: 'CURRENCY_CONVERSION_FEE_REBATE', quantity: 0.4}]},
        },
        order: {id: 13, quantity: 2, status: Trading212OrderStatus.FILLED, ticker: 'AAPL_US_EQ'},
      };

      const fill = Trading212BrokerMapper.toFilledOrder(item, pair, 'EUR');

      expect(fill.fee).toBe('0');
    });

    it('maps a filled SELL order from a negative fill quantity', () => {
      const item: HistoryOrder = {
        fill: {
          filledAt: '2025-06-02T15:00:00.000Z',
          price: 99,
          quantity: -3,
          walletImpact: {taxes: []},
        },
        order: {
          id: 8,
          quantity: -3,
          status: Trading212OrderStatus.FILLED,
          ticker: 'AAPL_US_EQ',
        },
      };

      const fill = Trading212BrokerMapper.toFilledOrder(item, pair, 'EUR');

      expect(fill.side).toBe(OrderSide.SELL);
      expect(fill.size).toBe('3');
    });

    it('falls back to the order quantity and creation time when the fill omits them', () => {
      const item: HistoryOrder = {
        fill: {price: 42},
        order: {
          createdAt: '2025-06-02T16:00:00.000Z',
          id: 9,
          quantity: -4,
          status: Trading212OrderStatus.FILLED,
          ticker: 'AAPL_US_EQ',
        },
      };

      const fill = Trading212BrokerMapper.toFilledOrder(item, pair, 'EUR');

      expect(fill.created_at).toBe('2025-06-02T16:00:00.000Z');
      expect(fill.fee).toBe('0');
      expect(fill.side).toBe(OrderSide.SELL);
      expect(fill.size).toBe('4');
    });

    it('throws when the order is not filled', () => {
      const item: HistoryOrder = {
        fill: {price: 42, quantity: 1},
        order: {id: 10, quantity: 1, status: Trading212OrderStatus.CANCELLED, ticker: 'AAPL_US_EQ'},
      };

      expect(() => Trading212BrokerMapper.toFilledOrder(item, pair, 'EUR')).toThrowError(
        'Order ID "10" is not filled.'
      );
    });

    it('throws when a FILLED entry carries no fill payload', () => {
      const item: HistoryOrder = {
        order: {id: 11, quantity: 1, status: Trading212OrderStatus.FILLED, ticker: 'AAPL_US_EQ'},
      };

      expect(() => Trading212BrokerMapper.toFilledOrder(item, pair, 'EUR')).toThrowError(
        'Order ID "11" is not filled.'
      );
    });
  });
});
