import Big from 'big.js';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {OrderSide, OrderType, type Candle} from '../Broker.js';
import {MarketDataSource} from '../MarketDataSource.js';
import {TradingPair} from '../TradingPair.js';
import type {Trading212API} from './api/Trading212API.js';
import type {Order} from './api/schema/OrderSchema.js';

// Shared mock references
const mockMethods = {
  getAccountCash: vi.fn(),
  getAccountInfo: vi.fn<Trading212API['getAccountInfo']>(),
  placeLimitOrder: vi.fn<Trading212API['placeLimitOrder']>(),
  placeMarketOrder: vi.fn<Trading212API['placeMarketOrder']>(),
};

vi.mock(import('./api/Trading212API.js'), () => ({
  Trading212API: class {
    getAccountCash = mockMethods.getAccountCash;
    getAccountInfo = mockMethods.getAccountInfo;
    placeLimitOrder = mockMethods.placeLimitOrder;
    placeMarketOrder = mockMethods.placeMarketOrder;
  } as unknown as typeof Trading212API,
}));

// Import after mocking
const {Trading212Broker} = await import('./Trading212Broker.js');
const {SimplifiedHttpError} = await import('../../util/SimplifiedHttpError.js');

/** `verifyCredentials` never touches market data, so every member can stay unimplemented. */
class MarketDataSourceStub extends MarketDataSource {
  async getCandles(): Promise<Candle[]> {
    throw new Error('Not implemented');
  }

  async getLatestCandle(): Promise<Candle> {
    throw new Error('Not implemented');
  }

  watchCandles() {
    return Promise.reject<string>(new Error('Not implemented'));
  }

  unwatchCandles(): void {}

  disconnect(): void {}
}

describe('Trading212Broker', {concurrent: false}, () => {
  let broker: InstanceType<typeof Trading212Broker>;

  beforeEach(() => {
    vi.clearAllMocks();
    broker = new Trading212Broker({
      apiKey: 'test',
      apiSecret: 'test',
      marketData: new MarketDataSourceStub(),
      usePaperTrading: true,
    });
  });

  describe('verifyCredentials', () => {
    it('resolves when the authenticated account-cash probe succeeds', async () => {
      mockMethods.getAccountCash.mockResolvedValue({
        blocked: null,
        free: 500.5,
        invested: 0,
        pieCash: 0,
        ppl: 0,
        result: 0,
        total: 500.5,
      });

      await expect(broker.verifyCredentials()).resolves.toBeUndefined();
      expect(mockMethods.getAccountCash).toHaveBeenCalledTimes(1);
    });

    it('rejects when Trading212 denies the credentials', async () => {
      mockMethods.getAccountCash.mockRejectedValue(
        new SimplifiedHttpError({
          data: 'Unauthorized',
          status: 401,
          statusText: 'Unauthorized',
          url: '/api/v0/equity/account/cash',
        })
      );

      const failure = broker.verifyCredentials();

      await expect(failure).rejects.toBeInstanceOf(SimplifiedHttpError);
      await expect(failure).rejects.toMatchObject({status: 401});
    });
  });

  describe('estimateFee', () => {
    it('denominates cross-currency estimates in the counter currency, not the account currency', async () => {
      // EUR account trading a GBX-quoted instrument: the FX-conversion fee applies
      mockMethods.getAccountInfo.mockResolvedValue({currencyCode: 'EUR', id: 1});
      const pair = new TradingPair('RRl_EQ', 'GBX');

      const fee = await broker.estimateFee(pair, OrderType.MARKET, new Big(1000));

      expect(
        fee.feeAsset,
        'notional × rate is measured in the notional’s own currency — labeling it EUR would misstate a ~£10 trade’s fee as €1.50'
      ).toBe('GBX');
      expect(fee.total.toFixed()).toBe('1.5');
      expect(fee.commission.toFixed(), 'Trading212 charges no commission on equities').toBe('0');
      expect(fee.currencyConversion.toFixed()).toBe('1.5');
    });

    it('charges no conversion fee when the account currency matches the counter', async () => {
      mockMethods.getAccountInfo.mockResolvedValue({currencyCode: 'EUR', id: 1});
      const pair = new TradingPair('RRUd_EQ', 'EUR');

      const fee = await broker.estimateFee(pair, OrderType.MARKET, new Big(1000));

      expect(fee.feeAsset).toBe('EUR');
      expect(fee.total.toFixed()).toBe('0');
    });
  });

  describe('placeOrder', () => {
    const pair = new TradingPair('RRl_EQ', 'GBX');

    const extendedHoursNotAllowed = () =>
      new SimplifiedHttpError({
        data: {
          detail: 'Extended hours trading is not allowed for this instrument',
          status: 400,
          title: 'Error while placing the order',
          type: '/api-errors/extended-hours-trading-not-allowed',
        },
        status: 400,
        statusText: 'Bad Request',
        url: '/api/v0/equity/orders/market',
      });

    const marketOrder: Order = {
      id: 53700020027,
      quantity: 1,
      status: 'NEW',
      strategy: 'QUANTITY',
      ticker: 'RRl_EQ',
      type: 'MARKET',
    };

    const limitOrder: Order = {
      ...marketOrder,
      limitPrice: 1490,
      type: 'LIMIT',
    };

    it('places market orders on the extended-hours venue first', async () => {
      mockMethods.placeMarketOrder.mockResolvedValue(marketOrder);

      await broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '1', sizeInCounter: false});

      expect(mockMethods.placeMarketOrder).toHaveBeenCalledTimes(1);
      expect(mockMethods.placeMarketOrder).toHaveBeenCalledWith({
        extendedHours: true,
        quantity: 1,
        ticker: 'RRl_EQ',
      });
    });

    it('retries market orders on regular hours when the venue rejects extended hours', async () => {
      mockMethods.placeMarketOrder.mockRejectedValueOnce(extendedHoursNotAllowed()).mockResolvedValue(marketOrder);

      const order = await broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '1', sizeInCounter: false});

      expect(mockMethods.placeMarketOrder).toHaveBeenCalledTimes(2);
      expect(
        mockMethods.placeMarketOrder,
        'fallback resubmits the identical order on regular hours only'
      ).toHaveBeenNthCalledWith(2, {
        extendedHours: false,
        quantity: 1,
        ticker: 'RRl_EQ',
      });
      expect(order.id).toBe('53700020027');
    });

    it('places limit orders without the extendedHours field', async () => {
      mockMethods.placeLimitOrder.mockResolvedValue(limitOrder);

      const order = await broker.placeLimitOrder(pair, {
        price: '1490',
        side: OrderSide.BUY,
        size: '1',
      });

      expect(mockMethods.placeLimitOrder).toHaveBeenCalledTimes(1);
      expect(
        mockMethods.placeLimitOrder,
        'the limit endpoint rejects any request carrying extendedHours with 400 "Invalid payload"'
      ).toHaveBeenCalledWith({
        limitPrice: 1490,
        quantity: 1,
        ticker: 'RRl_EQ',
        timeValidity: 'DAY',
      });
      expect(order.price).toBe('1490');
    });

    it('does not retry on other order rejections', async () => {
      const insufficientFunds = new SimplifiedHttpError({
        data: {
          status: 400,
          title: 'Error while placing the order',
          type: '/api-errors/insufficient-funds',
        },
        status: 400,
        statusText: 'Bad Request',
        url: '/api/v0/equity/orders/market',
      });
      mockMethods.placeMarketOrder.mockRejectedValue(insufficientFunds);

      const failure = broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '1', sizeInCounter: false});

      await expect(failure).rejects.toBe(insufficientFunds);
      expect(
        mockMethods.placeMarketOrder,
        'only the extended-hours rejection triggers a resubmit — anything else surfaces immediately'
      ).toHaveBeenCalledTimes(1);
    });
  });
});
