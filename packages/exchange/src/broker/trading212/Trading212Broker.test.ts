import Big from 'big.js';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {OrderSide, OrderType, type Fill} from '../Broker.js';
import {MarketDataSource} from '../MarketDataSource.js';
import {TradingPair} from '../TradingPair.js';
import {Trading212OrderStatus, Trading212TimeValidity} from './api/schema/OrderSchema.js';

// Shared mock references
const mockMethods = {
  cancelOrder: vi.fn(),
  getAccountCash: vi.fn(),
  getAccountInfo: vi.fn(),
  getHistoryOrders: vi.fn(),
  getHistoryOrdersPage: vi.fn(),
  getInstruments: vi.fn(),
  getOrders: vi.fn(),
  getPositions: vi.fn(),
  placeLimitOrder: vi.fn(),
  placeMarketOrder: vi.fn(),
};

vi.mock('./api/Trading212API.js', () => ({
  Trading212API: class {
    cancelOrder = mockMethods.cancelOrder;
    getAccountCash = mockMethods.getAccountCash;
    getAccountInfo = mockMethods.getAccountInfo;
    getHistoryOrders = mockMethods.getHistoryOrders;
    getHistoryOrdersPage = mockMethods.getHistoryOrdersPage;
    getInstruments = mockMethods.getInstruments;
    getOrders = mockMethods.getOrders;
    getPositions = mockMethods.getPositions;
    placeLimitOrder = mockMethods.placeLimitOrder;
    placeMarketOrder = mockMethods.placeMarketOrder;
  },
}));

class FakeMarketData extends MarketDataSource {
  disconnect = vi.fn();
  getCandles = vi.fn().mockResolvedValue([]);
  getLatestCandle = vi.fn();
  unwatchCandles = vi.fn();
  watchCandles = vi.fn().mockResolvedValue('candle-topic');
}

// Import after mocking
const {Trading212Broker} = await import('./Trading212Broker.js');

const accountInfoEUR = {currencyCode: 'EUR', id: 1};
const accountInfoUSD = {currencyCode: 'USD', id: 1};

function createFilledHistoryOrder(id: number) {
  return {
    fill: {
      filledAt: `2025-06-02T14:30:${`${id % 60}`.padStart(2, '0')}.000Z`,
      price: 100 + id,
      quantity: 1,
      walletImpact: {taxes: [{name: 'CURRENCY_CONVERSION_FEE', quantity: -0.25}]},
    },
    order: {id, quantity: 1, status: Trading212OrderStatus.FILLED, ticker: 'AAPL_US_EQ'},
  };
}

describe('Trading212Broker', {concurrent: false}, () => {
  const pair = new TradingPair('AAPL_US_EQ', 'USD');
  let broker: InstanceType<typeof Trading212Broker>;
  let marketData: FakeMarketData;

  beforeEach(() => {
    vi.clearAllMocks();
    marketData = new FakeMarketData();
    broker = new Trading212Broker({apiKey: 'test', apiSecret: 'test', marketData, usePaperTrading: true});
  });

  describe('placeLimitOrder', () => {
    it('places a DAY order on the extended-hours venue because Trading212 rejects GTC for equity limit orders', async () => {
      mockMethods.placeLimitOrder.mockResolvedValue({
        id: 101,
        limitPrice: 155.5,
        quantity: 2,
        status: Trading212OrderStatus.NEW,
        strategy: 'QUANTITY',
        ticker: 'AAPL_US_EQ',
        type: 'LIMIT',
      });

      const order = await broker.placeLimitOrder(pair, {price: '155.5', side: OrderSide.BUY, size: '2'});

      expect(order).toEqual({
        id: '101',
        pair,
        price: '155.5',
        side: OrderSide.BUY,
        size: '2',
        type: OrderType.LIMIT,
      });
      expect(mockMethods.placeLimitOrder).toHaveBeenCalledWith({
        extendedHours: true,
        limitPrice: 155.5,
        quantity: 2,
        ticker: 'AAPL_US_EQ',
        timeValidity: Trading212TimeValidity.DAY,
      });
    });

    it('encodes SELL as a negative quantity', async () => {
      mockMethods.placeLimitOrder.mockResolvedValue({
        id: 102,
        limitPrice: 160,
        quantity: -2,
        status: Trading212OrderStatus.NEW,
        strategy: 'QUANTITY',
        ticker: 'AAPL_US_EQ',
        type: 'LIMIT',
      });

      const order = await broker.placeLimitOrder(pair, {price: '160', side: OrderSide.SELL, size: '2'});

      expect(order.side).toBe(OrderSide.SELL);
      expect(order.size).toBe('2');
      expect(mockMethods.placeLimitOrder).toHaveBeenCalledWith(expect.objectContaining({quantity: -2}));
    });
  });

  describe('placeMarketOrder', () => {
    it('places a BUY order with a positive quantity', async () => {
      mockMethods.placeMarketOrder.mockResolvedValue({
        id: 103,
        quantity: 3,
        status: Trading212OrderStatus.NEW,
        strategy: 'QUANTITY',
        ticker: 'AAPL_US_EQ',
        type: 'MARKET',
      });

      const order = await broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '3', sizeInCounter: false});

      expect(order).toEqual({
        id: '103',
        pair,
        side: OrderSide.BUY,
        size: '3',
        type: OrderType.MARKET,
      });
      expect(mockMethods.placeMarketOrder).toHaveBeenCalledWith({
        extendedHours: true,
        quantity: 3,
        ticker: 'AAPL_US_EQ',
      });
    });

    it('encodes SELL as a negative quantity', async () => {
      mockMethods.placeMarketOrder.mockResolvedValue({
        id: 104,
        quantity: -3,
        status: Trading212OrderStatus.NEW,
        strategy: 'QUANTITY',
        ticker: 'AAPL_US_EQ',
        type: 'MARKET',
      });

      const order = await broker.placeMarketOrder(pair, {side: OrderSide.SELL, size: '3', sizeInCounter: false});

      expect(order.side).toBe(OrderSide.SELL);
      expect(order.size).toBe('3');
      expect(mockMethods.placeMarketOrder).toHaveBeenCalledWith(expect.objectContaining({quantity: -3}));
    });

    it('rejects notional (sizeInCounter) orders before hitting the API', async () => {
      await expect(
        broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '200', sizeInCounter: true})
      ).rejects.toThrow('Notional (sizeInCounter) orders are not supported by the Trading212 public API.');
      expect(mockMethods.placeMarketOrder).not.toHaveBeenCalled();
    });
  });

  describe('getOpenOrders', () => {
    it('keeps only MARKET/LIMIT quantity-strategy orders of the requested ticker', async () => {
      mockMethods.getOrders.mockResolvedValue([
        {
          id: 1,
          limitPrice: 150,
          quantity: 2,
          status: Trading212OrderStatus.NEW,
          strategy: 'QUANTITY',
          ticker: 'AAPL_US_EQ',
          type: 'LIMIT',
        },
        {
          id: 2,
          quantity: -1,
          status: Trading212OrderStatus.NEW,
          strategy: 'QUANTITY',
          ticker: 'AAPL_US_EQ',
          type: 'MARKET',
        },
        {
          id: 3,
          quantity: 1,
          status: Trading212OrderStatus.NEW,
          stopPrice: 140,
          strategy: 'QUANTITY',
          ticker: 'AAPL_US_EQ',
          type: 'STOP',
        },
        {
          id: 4,
          limitPrice: 150,
          quantity: 1,
          status: Trading212OrderStatus.NEW,
          stopPrice: 140,
          strategy: 'QUANTITY',
          ticker: 'AAPL_US_EQ',
          type: 'STOP_LIMIT',
        },
        {id: 5, status: Trading212OrderStatus.NEW, strategy: 'VALUE', ticker: 'AAPL_US_EQ', type: 'MARKET', value: 100},
        {
          id: 6,
          limitPrice: 10,
          quantity: 1,
          status: Trading212OrderStatus.NEW,
          strategy: 'QUANTITY',
          ticker: 'TSLA_US_EQ',
          type: 'LIMIT',
        },
      ]);

      const orders = await broker.getOpenOrders(pair);

      expect(orders).toEqual([
        {id: '1', pair, price: '150', side: OrderSide.BUY, size: '2', type: OrderType.LIMIT},
        {id: '2', pair, side: OrderSide.SELL, size: '1', type: OrderType.MARKET},
      ]);
    });
  });

  describe('cancelOpenOrders', () => {
    it('cancels only orders of the requested ticker and returns their ids', async () => {
      mockMethods.getOrders.mockResolvedValue([
        {
          id: 201,
          limitPrice: 90,
          quantity: 1,
          status: Trading212OrderStatus.NEW,
          strategy: 'QUANTITY',
          ticker: 'AAPL_US_EQ',
          type: 'LIMIT',
        },
        {
          id: 202,
          limitPrice: 95,
          quantity: 1,
          status: Trading212OrderStatus.NEW,
          strategy: 'QUANTITY',
          ticker: 'AAPL_US_EQ',
          type: 'LIMIT',
        },
        {
          id: 203,
          limitPrice: 10,
          quantity: 1,
          status: Trading212OrderStatus.NEW,
          strategy: 'QUANTITY',
          ticker: 'TSLA_US_EQ',
          type: 'LIMIT',
        },
      ]);
      mockMethods.cancelOrder.mockResolvedValue(undefined);

      const canceledIds = await broker.cancelOpenOrders(pair);

      expect(canceledIds).toEqual(['201', '202']);
      expect(mockMethods.cancelOrder).toHaveBeenCalledTimes(2);
      expect(mockMethods.cancelOrder).toHaveBeenCalledWith(201);
      expect(mockMethods.cancelOrder).toHaveBeenCalledWith(202);
    });
  });

  describe('getFills', () => {
    it('maps only FILLED history entries and debits fees in the account currency', async () => {
      mockMethods.getAccountInfo.mockResolvedValue(accountInfoEUR);
      mockMethods.getHistoryOrders.mockResolvedValue([
        createFilledHistoryOrder(12),
        {
          fill: null,
          order: {id: 11, quantity: 1, status: Trading212OrderStatus.CANCELLED, ticker: 'AAPL_US_EQ'},
        },
        createFilledHistoryOrder(10),
      ]);

      const fills = await broker.getFills(pair);

      expect(mockMethods.getHistoryOrders).toHaveBeenCalledWith('AAPL_US_EQ');
      expect(fills.map(fill => fill.order_id)).toEqual(['12', '10']);
      expect(fills[0]).toEqual({
        created_at: '2025-06-02T14:30:12.000Z',
        fee: '0.25',
        feeAsset: 'EUR',
        order_id: '12',
        pair,
        position: 'LONG',
        price: '112',
        side: OrderSide.BUY,
        size: '1',
      });
    });
  });

  describe('fees', () => {
    it('charges 0% commission and no conversion fee when the instrument matches the account currency', async () => {
      mockMethods.getAccountInfo.mockResolvedValue(accountInfoUSD);

      const rates = await broker.getFeeRates(pair);

      expect(rates[OrderType.LIMIT]).toEqual(new Big(0));
      expect(rates[OrderType.MARKET]).toEqual(new Big(0));
      expect(rates.CURRENCY_CONVERSION_FEE).toBeUndefined();
    });

    it('adds CURRENCY_CONVERSION_FEE only for cross-currency instruments', async () => {
      mockMethods.getAccountInfo.mockResolvedValue(accountInfoEUR);

      const rates = await broker.getFeeRates(pair);

      expect(rates[OrderType.LIMIT]).toEqual(new Big(0));
      expect(rates[OrderType.MARKET]).toEqual(new Big(0));
      expect(rates.CURRENCY_CONVERSION_FEE).toEqual(new Big(0.0015));
    });

    it('estimates cross-currency fees as conversion-only, debited in the account currency (getFeeAsset override)', async () => {
      mockMethods.getAccountInfo.mockResolvedValue(accountInfoEUR);

      const estimate = await broker.estimateFee(pair, OrderType.MARKET, new Big(1_000));

      expect(estimate.commission.toFixed()).toBe('0');
      expect(estimate.currencyConversion.toFixed()).toBe('1.5');
      expect(estimate.feeAsset).toBe('EUR');
      expect(estimate.total.toFixed()).toBe('1.5');
    });

    it('estimates a zero fee for same-currency instruments', async () => {
      mockMethods.getAccountInfo.mockResolvedValue(accountInfoUSD);

      const estimate = await broker.estimateFee(pair, OrderType.LIMIT, new Big(1_000));

      expect(estimate.feeAsset).toBe('USD');
      expect(estimate.total.toFixed()).toBe('0');
    });
  });

  describe('candle delegation', () => {
    it('converts the vendor ticker before delegating to the injected market-data source', async () => {
      const brkPair = new TradingPair('BRK_B_US_EQ', 'USD');
      const request = {
        intervalInMillis: 60_000,
        startTimeFirstCandle: '2025-06-02T14:00:00.000Z',
        startTimeLastCandle: '2025-06-02T15:00:00.000Z',
      };

      await broker.getCandles(brkPair, request);

      expect(marketData.getCandles).toHaveBeenCalledWith(new TradingPair('BRK.B', 'USD'), request);
    });
  });

  describe('watchOrders', () => {
    const instruments = [
      {addedOn: '2020-01-01T00:00:00.000Z', currencyCode: 'USD', name: 'Apple', ticker: 'AAPL_US_EQ', type: 'STOCK'},
    ];

    beforeEach(() => {
      vi.useFakeTimers();
      mockMethods.getAccountInfo.mockResolvedValue(accountInfoEUR);
      mockMethods.getInstruments.mockResolvedValue(instruments);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('takes a baseline snapshot so pre-existing fills are not replayed', async () => {
      mockMethods.getHistoryOrdersPage.mockResolvedValue({items: [createFilledHistoryOrder(10)], nextPagePath: null});
      const topicId = await broker.watchOrders(1_000);
      const fillHandler = vi.fn<(fill: Fill) => void>();
      broker.on(topicId, fillHandler);

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(0);
      expect(fillHandler).not.toHaveBeenCalled();

      mockMethods.getHistoryOrdersPage.mockResolvedValue({
        items: [createFilledHistoryOrder(11), createFilledHistoryOrder(10)],
        nextPagePath: null,
      });
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(fillHandler).toHaveBeenCalledTimes(1);
      expect(fillHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          feeAsset: 'EUR',
          order_id: '11',
          pair: new TradingPair('AAPL_US_EQ', 'USD'),
          price: '111',
          size: '1',
        })
      );
      broker.unwatchOrders(topicId);
    });

    it('pages through history until the last seen id so a burst of fills is not truncated', async () => {
      mockMethods.getHistoryOrdersPage
        .mockResolvedValueOnce({items: [createFilledHistoryOrder(10)], nextPagePath: null})
        .mockResolvedValueOnce({
          items: [createFilledHistoryOrder(13), createFilledHistoryOrder(12)],
          nextPagePath: '/api/v0/equity/history/orders?cursor=abc',
        })
        .mockResolvedValueOnce({
          items: [createFilledHistoryOrder(11), createFilledHistoryOrder(10)],
          nextPagePath: null,
        });

      const topicId = await broker.watchOrders(1_000);
      const fillHandler = vi.fn<(fill: Fill) => void>();
      broker.on(topicId, fillHandler);

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockMethods.getHistoryOrdersPage).toHaveBeenCalledTimes(3);
      expect(mockMethods.getHistoryOrdersPage).toHaveBeenNthCalledWith(3, {
        nextPath: '/api/v0/equity/history/orders?cursor=abc',
      });
      // Fills are emitted oldest-first so consumers see them in execution order.
      expect(fillHandler.mock.calls.map(([fill]) => fill.order_id)).toEqual(['11', '12', '13']);
      broker.unwatchOrders(topicId);
    });

    it('unwatchOrders stops the polling timer', async () => {
      mockMethods.getHistoryOrdersPage.mockResolvedValue({items: [], nextPagePath: null});

      const topicId = await broker.watchOrders(1_000);
      broker.unwatchOrders(topicId);
      await vi.advanceTimersByTimeAsync(5_000);

      // Only the baseline snapshot ran; no polling tick fired after unwatching.
      expect(mockMethods.getHistoryOrdersPage).toHaveBeenCalledTimes(1);
    });

    it('emits "error" instead of throwing and keeps polling after an API failure', async () => {
      mockMethods.getHistoryOrdersPage
        .mockResolvedValueOnce({items: [], nextPagePath: null})
        .mockRejectedValueOnce(new Error('Trading212 is down'))
        .mockResolvedValueOnce({items: [createFilledHistoryOrder(21)], nextPagePath: null});

      const topicId = await broker.watchOrders(1_000);
      const errorHandler = vi.fn();
      const fillHandler = vi.fn<(fill: Fill) => void>();
      broker.on('error', errorHandler);
      broker.on(topicId, fillHandler);

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(0);
      expect(errorHandler).toHaveBeenCalledWith(new Error('Trading212 is down'));
      expect(fillHandler).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(0);
      expect(fillHandler).toHaveBeenCalledWith(expect.objectContaining({order_id: '21'}));
      broker.unwatchOrders(topicId);
    });
  });
});
