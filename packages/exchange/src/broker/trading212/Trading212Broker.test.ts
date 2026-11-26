import {beforeEach, describe, expect, it, vi} from 'vitest';
import Big from 'big.js';
import {OrderSide, OrderType, type Candle} from '../Broker.js';
import {TradingPair} from '../TradingPair.js';
import {MarketDataSource} from '../MarketDataSource.js';
import type {Trading212API} from './api/Trading212API.js';
import {Trading212OrderStatus} from './api/schema/OrderSchema.js';

// Shared mock references
const mockMethods = {
  getAccountCash: vi.fn(),
  getAccountInfo: vi.fn<Trading212API['getAccountInfo']>(),
  getInstruments: vi.fn<Trading212API['getInstruments']>(),
  getTransactions: vi.fn<Trading212API['getTransactions']>(),
  placeLimitOrder: vi.fn<Trading212API['placeLimitOrder']>(),
  placeMarketOrder: vi.fn<Trading212API['placeMarketOrder']>(),
  placeStopLimitOrder: vi.fn<Trading212API['placeStopLimitOrder']>(),
  placeStopOrder: vi.fn<Trading212API['placeStopOrder']>(),
};

vi.mock(import('./api/Trading212API.js'), () => ({
  Trading212API: class {
    getAccountCash = mockMethods.getAccountCash;
    getTransactions = mockMethods.getTransactions;
    getAccountInfo = mockMethods.getAccountInfo;
    getInstruments = mockMethods.getInstruments;
    placeLimitOrder = mockMethods.placeLimitOrder;
    placeMarketOrder = mockMethods.placeMarketOrder;
    placeStopOrder = mockMethods.placeStopOrder;
    placeStopLimitOrder = mockMethods.placeStopLimitOrder;
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

  protected override async getNewestCandles(): Promise<Candle[]> {
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
    const LIMIT_PAIR = new TradingPair('AMD_US_EQ', 'USD');
    const INSTRUMENTS = [
      {
        addedOn: '2018-07-12T07:10:11.000+03:00',
        currencyCode: 'USD',
        extendedHours: true,
        name: 'Apple',
        ticker: 'AAPL_US_EQ',
        type: 'STOCK' as const,
      },
      {
        addedOn: '2018-07-12T07:10:10.000+03:00',
        currencyCode: 'GBX',
        extendedHours: false,
        name: 'Rolls-Royce',
        ticker: 'RRl_EQ',
        type: 'STOCK' as const,
      },
    ];
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
      mockMethods.getInstruments.mockResolvedValue(INSTRUMENTS);
      mockMethods.placeLimitOrder.mockResolvedValue(ACCEPTED_ORDER);
      mockMethods.placeMarketOrder.mockResolvedValue({...ACCEPTED_ORDER, limitPrice: null, type: 'MARKET'});
      mockMethods.placeStopOrder.mockResolvedValue({
        ...ACCEPTED_ORDER,
        limitPrice: null,
        stopPrice: 160,
        type: 'STOP',
      });
      mockMethods.placeStopLimitOrder.mockResolvedValue({...ACCEPTED_ORDER, stopPrice: 160, type: 'STOP_LIMIT'});
    });

    it('spells out GOOD_TILL_CANCEL, which is the only spelling the stop endpoint takes', async () => {
      await broker.placeStopOrder(LIMIT_PAIR, {side: OrderSide.SELL, size: '3', stopPrice: '160'});

      const payload = mockMethods.placeStopOrder.mock.calls[0]?.[0];
      expect(payload, 'the stop endpoint answers "Invalid payload" to the GTC the limit endpoint takes').toEqual({
        quantity: -3,
        stopPrice: 160,
        ticker: 'AMD_US_EQ',
        timeValidity: 'GOOD_TILL_CANCEL',
      });
    });

    it('reports the trigger the venue acknowledged rather than the one that was asked for', async () => {
      mockMethods.placeStopOrder.mockResolvedValue({
        ...ACCEPTED_ORDER,
        limitPrice: null,
        stopPrice: 159.5,
        type: 'STOP',
      });

      const order = await broker.placeStopOrder(LIMIT_PAIR, {side: OrderSide.SELL, size: '3', stopPrice: '160'});

      expect(order.stopPrice, 'a venue that rounds the trigger to a tick moves where the stop actually sits').toBe(
        '159.5'
      );
      expect(order.type).toBe(OrderType.STOP);
    });

    it('carries both prices on a stop-limit order', async () => {
      await broker.placeStopLimitOrder(LIMIT_PAIR, {
        price: '158',
        side: OrderSide.SELL,
        size: '3',
        stopPrice: '160',
      });

      const payload = mockMethods.placeStopLimitOrder.mock.calls[0]?.[0];
      expect(payload, 'the trigger and the worst acceptable fill are two separate prices').toEqual({
        limitPrice: 158,
        quantity: -3,
        stopPrice: 160,
        ticker: 'AMD_US_EQ',
        timeValidity: 'GOOD_TILL_CANCEL',
      });
    });

    it('sends a limit order without the field the limit endpoint refuses', async () => {
      await broker.placeLimitOrder(LIMIT_PAIR, {price: '172', side: OrderSide.BUY, size: '1'});

      const payload = mockMethods.placeLimitOrder.mock.calls[0]?.[0];
      expect(payload, 'Trading212 answers "Invalid payload" when extendedHours reaches the limit endpoint').toEqual({
        limitPrice: 172,
        quantity: 1,
        ticker: 'AMD_US_EQ',
        timeValidity: 'DAY',
      });
    });

    it.each([
      {expected: true, ticker: 'AAPL_US_EQ', venue: 'a US listing that reaches the 24/5 venue'},
      {expected: false, ticker: 'RRl_EQ', venue: 'a London listing that does not'},
    ])('sends what the instrument itself says about extended hours: $venue', async ({expected, ticker}) => {
      await broker.placeMarketOrder(new TradingPair(ticker, ticker === 'RRl_EQ' ? 'GBX' : 'USD'), {
        side: OrderSide.SELL,
        size: '2',
        sizeInCounter: false,
      });

      const payload = mockMethods.placeMarketOrder.mock.calls[0]?.[0];
      expect(payload, 'the sign of the quantity is how Trading212 encodes the side').toEqual({
        extendedHours: expected,
        quantity: -2,
        ticker,
      });
    });

    it('leaves the field out for an instrument it does not know', async () => {
      await broker.placeMarketOrder(new TradingPair('MISSING_EQ', 'USD'), {
        side: OrderSide.BUY,
        size: '1',
        sizeInCounter: false,
      });

      const payload = mockMethods.placeMarketOrder.mock.calls[0]?.[0];
      expect(payload, 'an unknown instrument means the default session, not a claim of 24/5 access').toEqual({
        extendedHours: undefined,
        quantity: 1,
        ticker: 'MISSING_EQ',
      });
    });

    it('fetches the instrument list once and reuses it', async () => {
      const pair = new TradingPair('AAPL_US_EQ', 'USD');
      await broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '1', sizeInCounter: false});
      await broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '1', sizeInCounter: false});

      expect(
        mockMethods.getInstruments,
        'Trading212 allows one instrument request per 50 seconds, which no order path should spend twice'
      ).toHaveBeenCalledTimes(1);
    });
  });
  describe('getFeeRates', () => {
    it('charges the conversion fee only when the instrument is in another currency', async () => {
      mockMethods.getAccountInfo.mockResolvedValue({currencyCode: 'EUR', id: 1});

      const foreign = await broker.getFeeRates(new TradingPair('AAPL', 'USD'));
      const domestic = await broker.getFeeRates(new TradingPair('ALV', 'EUR'));

      expect(
        foreign.CURRENCY_CONVERSION_FEE?.toString(),
        'Trading212 bakes 0.15% into the rate when an order has to convert, as its ledger shows'
      ).toBe('0.0015');
      expect(domestic.CURRENCY_CONVERSION_FEE, 'no conversion, no conversion fee').toBeUndefined();
    });

    it('compares against the primary currency even though wallets exist in others', async () => {
      mockMethods.getAccountInfo.mockResolvedValue({currencyCode: 'EUR', id: 1});

      const rates = await broker.getFeeRates(new TradingPair('AAPL', 'USD'));

      expect(
        rates.CURRENCY_CONVERSION_FEE?.toString(),
        'neither order endpoint takes a currency, so an API order settles from the primary currency and converts however the account is funded'
      ).toBe('0.0015');
    });
  });

  describe('getFeeAsset', () => {
    it('reports a trade’s fees in the settling wallet, not the instrument currency', async () => {
      mockMethods.getAccountInfo.mockResolvedValue({currencyCode: 'EUR', id: 1});
      const pair = new TradingPair('AAPL', 'USD');

      const estimate = await broker.estimateFee(pair, OrderType.MARKET, new Big(1_000));

      expect(
        estimate.feeAsset,
        'every live US-stock fill on this EUR account booked its CURRENCY_CONVERSION_FEE in EUR; a manual wallet conversion charges in the acquired currency, which is a different operation'
      ).toBe('EUR');
    });
  });
});
