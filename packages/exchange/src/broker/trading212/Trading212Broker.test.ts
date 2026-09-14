import {beforeEach, describe, expect, it, vi} from 'vitest';
import {OrderSide, type Candle} from '../Broker.js';
import {TradingPair} from '../TradingPair.js';
import {MarketDataSource} from '../MarketDataSource.js';
import type {Trading212API} from './api/Trading212API.js';
import {Trading212OrderStatus} from './api/schema/OrderSchema.js';

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
  describe('placeOrder', () => {
    const PAIR = new TradingPair('AMD_US_EQ', 'USD');
    const ACCEPTED_ORDER = {
      creationTime: '2026-09-13T22:00:00.000Z',
      id: 1,
      limitPrice: 172,
      quantity: 1,
      status: Trading212OrderStatus.CONFIRMED,
      strategy: 'QUANTITY',
      ticker: 'AMD_US_EQ',
      type: 'LIMIT',
      value: null,
    } as const;

    beforeEach(() => {
      mockMethods.getAccountInfo.mockResolvedValue({currencyCode: 'EUR', id: 1});
      mockMethods.placeLimitOrder.mockResolvedValue(ACCEPTED_ORDER);
      mockMethods.placeMarketOrder.mockResolvedValue({...ACCEPTED_ORDER, limitPrice: null, type: 'MARKET'});
    });

    it('sends a limit order without the field the limit endpoint refuses', async () => {
      await broker.placeLimitOrder(PAIR, {price: '172', side: OrderSide.BUY, size: '1'});

      const payload = mockMethods.placeLimitOrder.mock.calls[0]?.[0];
      expect(payload, 'Trading212 answers "Invalid payload" when extendedHours reaches the limit endpoint').toEqual({
        limitPrice: 172,
        quantity: 1,
        ticker: 'AMD_US_EQ',
        timeValidity: 'DAY',
      });
    });

    it('keeps routing market orders through the 24/5 venue, which accepts the field', async () => {
      await broker.placeMarketOrder(PAIR, {side: OrderSide.SELL, size: '2', sizeInCounter: false});

      const payload = mockMethods.placeMarketOrder.mock.calls[0]?.[0];
      expect(payload, 'the sign of the quantity is how Trading212 encodes the side').toEqual({
        extendedHours: true,
        quantity: -2,
        ticker: 'AMD_US_EQ',
      });
    });
  });
});
